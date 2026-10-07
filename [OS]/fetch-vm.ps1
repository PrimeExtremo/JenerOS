# Copies the JenerOS VMware disk from the build VM to S:\[VMs]\[JENEROS] and
# drops in the .vmx the first time. Run on Windows after [OS]/build.sh finishes.
#   .\[OS]\fetch-vm.ps1
#   .\[OS]\fetch-vm.ps1 -BuildHost jeneros-build -Dest 'S:\[VMs]\[JENEROS]'
param(
    [string]$BuildHost = 'jeneros-build',
    [string]$Dest = 'S:\[VMs]\[JENEROS]'
)
$ErrorActionPreference = 'Stop'

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$vmdk = Join-Path $Dest 'jeneros.vmdk'
scp "${BuildHost}:jeneros-out/jeneros.vmdk" $vmdk
if ($LASTEXITCODE -ne 0) { throw "scp failed ($LASTEXITCODE)" }

$vmx = Join-Path $Dest 'jeneros.vmx'
if (-not (Test-Path -LiteralPath $vmx)) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'vmware\jeneros.vmx') -Destination $vmx
}
Write-Host "Done. Open $vmx in VMware Workstation."
