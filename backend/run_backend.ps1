<# Run backend with the venv activated. Usage: .\run_backend.ps1 #>
$ErrorActionPreference = 'Stop'
if (-not (Test-Path .venv)) {
    Write-Host ".venv not found. Run .\setup_venv.ps1 first."; exit 1
}
.\.venv\Scripts\Activate.ps1
Write-Host "Starting backend on http://127.0.0.1:8000"
uvicorn app:app --reload
