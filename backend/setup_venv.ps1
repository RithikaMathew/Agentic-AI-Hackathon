<#
PowerShell helper to create a Python venv, install requirements, and copy .env.template to .env if missing.
Run this from the backend folder: .\setup_venv.ps1
#>
$ErrorActionPreference = 'Stop'

Write-Host "Creating virtual environment in .venv..."
python -m venv .venv

Write-Host "Activating venv and installing requirements..."
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
if (Test-Path requirements.txt) {
    pip install -r requirements.txt
}

if (-not (Test-Path .env) -and (Test-Path .env.template)) {
    Write-Host "Copying .env.template to .env (please add your API key to .env)"
    Copy-Item .env.template .env
}

Write-Host "Setup complete. Activate the venv with: .\.venv\Scripts\Activate.ps1"
Write-Host "Run the server: uvicorn app:app --reload"
