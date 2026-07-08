Add-Type -AssemblyName System.Drawing

$sourcePath = "public/logo.png"
if (-not (Test-Path $sourcePath)) {
    Write-Error "Source file public/logo.png not found."
    exit 1
}

$sizes = @(
    @{ Width = 16; Height = 16; Name = "favicon-16x16.png" }
    @{ Width = 32; Height = 32; Name = "favicon-32x32.png" }
    @{ Width = 180; Height = 180; Name = "apple-touch-icon.png" }
    @{ Width = 192; Height = 192; Name = "android-chrome-192x192.png" }
    @{ Width = 512; Height = 512; Name = "android-chrome-512x512.png" }
    @{ Width = 32; Height = 32; Name = "favicon.ico" }
)

$srcImage = [System.Drawing.Image]::FromFile($sourcePath)

foreach ($size in $sizes) {
    $destPath = "public/" + $size.Name
    $newImage = New-Object System.Drawing.Bitmap($size.Width, $size.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($newImage)
    
    # Set high quality resize settings
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $graphics.DrawImage($srcImage, 0, 0, $size.Width, $size.Height)
    
    # Clean up graphics context
    $graphics.Dispose()
    
    # Save as PNG (even favicon.ico is saved as PNG, which is widely supported by modern browsers)
    $newImage.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $newImage.Dispose()
    
    Write-Host "Generated $destPath" -ForegroundColor Green
}

$srcImage.Dispose()
Write-Host "All icons generated successfully!" -ForegroundColor Green
