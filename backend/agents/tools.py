import os
import subprocess
import re
import urllib.parse
import zipfile
import contextvars
from typing import List
from langchain_core.tools import tool
import requests

from pathlib import Path
TOOLS_DIR = Path(__file__).resolve().parent
if TOOLS_DIR.parent.name == "backend":
    WORKSPACE_ROOT = str(TOOLS_DIR.parent.parent)
else:
    WORKSPACE_ROOT = str(TOOLS_DIR.parent)

# Context variable to hold authenticated user id (set by route handler from Clerk JWT sub claim)
user_id_var = contextvars.ContextVar("user_id", default="default")

def get_user_id() -> str:
    uid = user_id_var.get()
    if uid == "default":
        return uid
    # Clerk user IDs are like "user_2abc123..." — safe alphanumeric+underscore
    safe_id = "".join(c for c in uid if c.isalnum() or c in "-_")
    return safe_id if safe_id else "default_user"

def get_session_workspace() -> str:
    user_id = get_user_id()
    if user_id == "default":
        return WORKSPACE_ROOT
    session_workspace = os.path.join(WORKSPACE_ROOT, "workspaces", user_id)
    os.makedirs(session_workspace, exist_ok=True)
    return session_workspace

def _resolve_path(path: str) -> str:
    workspace = get_session_workspace()
    abs_path = os.path.realpath(os.path.realpath(os.path.join(workspace, path)))
    if os.path.commonpath([workspace, abs_path]) != workspace:
        raise ValueError(f"Access denied: path '{path}' is outside the workspace root.")
    
    backend_dir = os.path.realpath(os.path.join(WORKSPACE_ROOT, "backend"))
    if os.path.commonpath([backend_dir, abs_path]) == backend_dir:
        raise ValueError("Access denied: accessing files in the 'backend' directory is prohibited.")

    filename = os.path.basename(abs_path)
    if filename == ".env" or filename.endswith(".env") or ".env" in abs_path:
        raise ValueError("Access denied: accessing environment configuration files is prohibited.")
        
    return abs_path

def _truncate_output(text: str, max_chars: int = 50000) -> str:
    if len(text) <= max_chars:
        return text
    half = max_chars // 2
    return text[:half] + f"\n\n... [TRUNCATED {len(text) - max_chars} CHARACTERS FOR CONTEXT LIMITS] ...\n\n" + text[-half:]

@tool
def read_workspace_file(path: str) -> str:
    """Reads the contents of a file inside the workspace.
    
    Args:
        path: The relative path to the file from the workspace root.
    """
    try:
        resolved = _resolve_path(path)
        if not os.path.exists(resolved):
            return f"Error: File '{path}' does not exist."
        if os.path.isdir(resolved):
            return f"Error: '{path}' is a directory. Check path."
        with open(resolved, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            return _truncate_output(content, max_chars=80000)
    except Exception as e:
        return f"Error reading file: {str(e)}"

@tool
def write_workspace_file(path: str, content: str) -> str:
    """Creates a new file or overwrites an existing file with the specified content.
    
    Args:
        path: The relative path to the file from the workspace root.
        content: The content to write into the file.
    """
    try:
        resolved = _resolve_path(path)
        os.makedirs(os.path.dirname(resolved), exist_ok=True)
        with open(resolved, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Success: File '{path}' written successfully."
    except Exception as e:
        return f"Error writing file: {str(e)}"

@tool
def execute_command(command: str) -> str:
    """Executes a shell command in the workspace directory.
    
    Args:
        command: The terminal command to run (e.g. 'npm run build', 'pytest').
    """

    normalized_cmd = command.lower()
    banned_tokens = [".env", "environ", "printenv", "getenv", "env", "token", "password", "secret", "key"]
    if "backend" in normalized_cmd or "deploy_hf_api" in normalized_cmd or any(token in normalized_cmd for token in banned_tokens):
        return "Access denied: executing commands targeting backend, environment, secrets, or credentials files is prohibited."
    try:
        res = subprocess.run(
            command,
            shell=True,
            cwd=get_session_workspace(),
            capture_output=True,
            text=True,
            timeout=30
        )
        output = []
        if res.stdout:
            output.append(_truncate_output(res.stdout, max_chars=40000))
        if res.stderr:
            output.append(_truncate_output(res.stderr, max_chars=20000))
        return "\n".join(output) if output else "Command finished with no output."
    except subprocess.TimeoutExpired:
        return "Error: Command timed out after 30 seconds."
    except Exception as e:
        return f"Error executing command: {str(e)}"

@tool
def web_search(query: str) -> str:
    """Performs a web search to gather info or documentation.
    
    Args:
        query: The search term.
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        encoded_query = urllib.parse.quote_plus(query)
        url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code != 200:
            return f"Error: Search request failed with status code {r.status_code}"
        
        snippets = re.findall(
            r'<a class="result__snippet"[^>]*>(.*?)</a>', 
            r.text, 
            re.DOTALL
        )
        
        results = []
        for s in snippets[:5]:
            clean_snippet = re.sub(r'<[^>]+>', '', s).strip()
            clean_snippet = (
                clean_snippet.replace("&quot;", '"')
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&#x27;", "'")
            )
            results.append(clean_snippet)
            
        return "\n\n".join(results) if results else "No search results found."
    except Exception as e:
        return f"Error searching the web: {str(e)}"

@tool
def create_zip_archive(files: List[str], archive_name: str) -> str:
    """Creates a zip archive containing the specified list of workspace files, placing it in the downloads directory.
    
    Args:
        files: A list of relative paths to the files to include in the zip archive.
        archive_name: The name of the zip file (e.g. 'landing_page.zip').
    """
    try:
        if not archive_name.endswith(".zip"):
            archive_name += ".zip"
            
        user_id = get_user_id()
        if WORKSPACE_ROOT.endswith("backend") or os.path.basename(WORKSPACE_ROOT) == "backend":
            downloads_base = os.path.join(os.path.dirname(WORKSPACE_ROOT), "public", "downloads")
        else:
            downloads_base = os.path.join(WORKSPACE_ROOT, "public", "downloads")
            
        downloads_dir = os.path.join(downloads_base, user_id)
        os.makedirs(downloads_dir, exist_ok=True)
        
        archive_path = os.path.join(downloads_dir, archive_name)
        
        with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for file_path in files:
                resolved_file = _resolve_path(file_path)
                if not os.path.exists(resolved_file):
                    return f"Error: File '{file_path}' does not exist."
                if os.path.isdir(resolved_file):
                    for root, dirs, filenames in os.walk(resolved_file):
                        for filename in filenames:
                            filepath = os.path.join(root, filename)
                            if "backend" in filepath.lower():
                                continue
                            arcname = os.path.relpath(filepath, os.path.dirname(resolved_file))
                            zip_file.write(filepath, arcname)
                else:
                    arcname = os.path.basename(resolved_file)
                    zip_file.write(resolved_file, arcname)
                    
        return f"Success: Created zip archive. The user can download it at: /api/downloads/{user_id}/{archive_name}"
    except Exception as e:
        return f"Error creating zip archive: {str(e)}"

@tool
def list_workspace_directory(path: str = ".") -> str:
    """Lists the contents of a directory inside the workspace.
    
    Args:
        path: The relative path to the directory (e.g. '.', 'src/components').
    """
    try:
        resolved = _resolve_path(path)
        if not os.path.exists(resolved):
            return f"Error: Path '{path}' does not exist."
        if not os.path.isdir(resolved):
            return f"Error: '{path}' is a file, not a directory."
            
        items = os.listdir(resolved)
        result = []
        for item in items:
            full_item_path = os.path.join(resolved, item)
            if item == "backend" and resolved == WORKSPACE_ROOT:
                continue
            is_dir = os.path.isdir(full_item_path)
            type_str = "DIR" if is_dir else "FILE"
            size_str = f" ({os.path.getsize(full_item_path)} bytes)" if not is_dir else ""
            result.append(f"[{type_str}] {item}{size_str}")
            
        return "\n".join(result) if result else "Directory is empty."
    except Exception as e:
        return f"Error listing directory: {str(e)}"

@tool
def unzip_archive(zip_path: str, dest_dir: str = "") -> str:
    """Extracts the contents of a zip archive in the workspace.
    
    Args:
        zip_path: The relative path to the zip file inside the workspace (e.g. 'project.zip').
        dest_dir: The relative path to the directory where files should be extracted. Defaults to the same directory as the archive.
    """
    try:
        resolved_archive = _resolve_path(zip_path)
        if not os.path.exists(resolved_archive):
            return f"Error: Archive file '{zip_path}' does not exist."
            
        if not dest_dir:
            resolved_dest = os.path.dirname(resolved_archive)
        else:
            resolved_dest = _resolve_path(dest_dir)
            
        os.makedirs(resolved_dest, exist_ok=True)
        
        if resolved_archive.lower().endswith(".rar"):
            return "Error: RAR extraction is no longer supported for security reasons. Please convert to .zip."
        
        max_extract_size = 500 * 1024 * 1024 # 500 MB zip bomb limit
        extracted_size = 0
        
        with zipfile.ZipFile(resolved_archive, 'r') as zip_ref:
            for member in zip_ref.namelist():
                member_path = os.path.realpath(os.path.join(resolved_dest, member))
                if os.path.commonpath([resolved_dest, member_path]) != resolved_dest:
                    return f"Error: Zip member '{member}' attempted to escape extraction directory."
                
                info = zip_ref.getinfo(member)
                extracted_size += info.file_size
                if extracted_size > max_extract_size:
                    return f"Error: Zip extraction exceeded size limit ({max_extract_size // (1024*1024)}MB). Possible zip-bomb blocked."
                    
            zip_ref.extractall(resolved_dest)
            
        return f"Success: Extracted zip archive '{zip_path}' to '{dest_dir or os.path.dirname(zip_path)}'."
    except Exception as e:
        return f"Error extracting archive: {str(e)}"

tools = [read_workspace_file, write_workspace_file, execute_command, web_search, create_zip_archive, list_workspace_directory, unzip_archive]
TOOL_MAP = {t.name: t for t in tools}