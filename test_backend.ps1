# PowerShell test script for FAU Chat Assistant backend
# Run this from any directory - it will test your backend

$backendUrl = "http://127.0.0.1:8000"

function Test-BackendMessage {
    param([string]$Message)
    
    Write-Host "`n🔍 Testing message: '$Message'" -ForegroundColor Cyan
    Write-Host ("-" * 50) -ForegroundColor Gray
    
    try {
        # Prepare request
        $body = @{ message = $Message } | ConvertTo-Json -Compress
        
        # Send request
        $response = Invoke-RestMethod -Method Post -Uri "$backendUrl/orchestrate" -Body $body -ContentType 'application/json' -TimeoutSec 30
        
        # Print summary
        $summary = $response.summary
        Write-Host "Summary: $summary" -ForegroundColor Green
        
        # Print steps
        $steps = $response.steps
        Write-Host "Steps ($($steps.Count)):" -ForegroundColor Yellow
        for ($i = 0; $i -lt $steps.Count; $i++) {
            $step = $steps[$i]
            $instruction = $step.instruction
            $target = $step.target_text
            Write-Host "  $($i + 1). $instruction" -ForegroundColor White
            Write-Host "     → Target: '$target'" -ForegroundColor Magenta
        }
        
        # Print raw response
        Write-Host "`nRaw JSON Response:" -ForegroundColor Gray
        $response | ConvertTo-Json -Depth 10
        
    } catch [System.Net.WebException] {
        Write-Host "❌ Cannot connect to backend. Make sure it's running on $backendUrl" -ForegroundColor Red
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Main script
Write-Host "🚀 FAU Chat Assistant Backend Test" -ForegroundColor Cyan
Write-Host ("=" * 50) -ForegroundColor Gray

# Test health endpoint first
try {
    $health = Invoke-RestMethod -Method Get -Uri "$backendUrl/health" -TimeoutSec 5
    Write-Host "✅ Backend health check: $($health | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend health check failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test messages
$testMessages = @(
    "How do I register for classes?",
    "How to contact advisor?", 
    "How do I drop a course?",
    "Where is the library?",
    "How to apply for financial aid?"
)

foreach ($message in $testMessages) {
    Test-BackendMessage -Message $message
    Write-Host
}

Write-Host "✅ Test completed!" -ForegroundColor Green

# Interactive mode
Write-Host "`n$('=' * 50)" -ForegroundColor Gray
Write-Host "🔧 Interactive Mode - Type your own messages (or 'quit' to exit)" -ForegroundColor Cyan

do {
    $userInput = Read-Host "`nEnter message"
    if ($userInput -and $userInput.ToLower() -notin @('quit', 'exit', 'q')) {
        Test-BackendMessage -Message $userInput
    }
} while ($userInput.ToLower() -notin @('quit', 'exit', 'q'))

Write-Host "👋 Goodbye!" -ForegroundColor Cyan