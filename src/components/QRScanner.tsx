import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, CameraOff, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface QRScannerProps {
  onScan: (code: string) => void;
  isProcessing?: boolean;
  lastResult?: { success: boolean; message: string } | null;
}

interface CameraDevice {
  id: string;
  label: string;
}

export const QRScanner = ({ onScan, isProcessing = false, lastResult }: QRScannerProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [lastScannedCode, setLastScannedCode] = useState<string>("");
  const lastScanTimeRef = useRef<number>(0);

  // Debounce para evitar escaneos múltiples del mismo código
  const SCAN_COOLDOWN_MS = 2000;

  // Obtener cámaras disponibles
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          const cameraList = devices.map((device) => ({
            id: device.id,
            label: device.label || `Cámara ${device.id.slice(0, 8)}`,
          }));
          setCameras(cameraList);
          
          // Preferir cámara trasera si está disponible
          const backCamera = cameraList.find(
            (c) => c.label.toLowerCase().includes("back") || 
                   c.label.toLowerCase().includes("trasera") ||
                   c.label.toLowerCase().includes("rear")
          );
          setSelectedCamera(backCamera?.id || cameraList[0].id);
        } else {
          setError("No se encontraron cámaras");
        }
      })
      .catch((err) => {
        console.error("Error getting cameras:", err);
        setError("Error al acceder a las cámaras. Verifica los permisos.");
      });

    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = useCallback(async () => {
    if (!selectedCamera || !containerRef.current) {
      toast.error("Selecciona una cámara primero");
      return;
    }

    try {
      setError("");
      
      // Crear instancia si no existe
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader");
      }

      // Verificar si ya está escaneando
      if (scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
        await scannerRef.current.stop();
      }

      await scannerRef.current.start(
        selectedCamera,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          const now = Date.now();
          
          // Evitar escaneos repetidos del mismo código
          if (
            decodedText === lastScannedCode &&
            now - lastScanTimeRef.current < SCAN_COOLDOWN_MS
          ) {
            return;
          }

          lastScanTimeRef.current = now;
          setLastScannedCode(decodedText);
          
          // Vibrar si está disponible
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          
          onScan(decodedText);
        },
        (errorMessage) => {
          // Ignorar errores de "no QR found" - son normales
          if (!errorMessage.includes("No MultiFormat Readers")) {
            console.debug("Scan error:", errorMessage);
          }
        }
      );

      setIsScanning(true);
      toast.success("Cámara activada");
    } catch (err: any) {
      console.error("Error starting scanner:", err);
      setError(err.message || "Error al iniciar el scanner");
      toast.error("Error al activar la cámara");
    }
  }, [selectedCamera, lastScannedCode, onScan]);

  const stopScanning = useCallback(async () => {
    try {
      if (scannerRef.current) {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await scannerRef.current.stop();
        }
      }
      setIsScanning(false);
    } catch (err) {
      console.error("Error stopping scanner:", err);
    }
  }, []);

  const handleCameraChange = useCallback(async (cameraId: string) => {
    setSelectedCamera(cameraId);
    
    if (isScanning) {
      await stopScanning();
      // Pequeño delay para asegurar que la cámara anterior se liberó
      setTimeout(() => {
        startScanning();
      }, 300);
    }
  }, [isScanning, stopScanning, startScanning]);

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-cyan-400" />
            Scanner QR
          </span>
          {isScanning && (
            <span className="flex items-center gap-2 text-sm font-normal text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Escaneando
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selector de cámara */}
        <div className="flex gap-2">
          <Select 
            value={selectedCamera} 
            onValueChange={handleCameraChange}
            disabled={cameras.length === 0}
          >
            <SelectTrigger className="border-white/20 bg-white/5 flex-1">
              <SelectValue placeholder="Seleccionar cámara" />
            </SelectTrigger>
            <SelectContent>
              {cameras.map((camera) => (
                <SelectItem key={camera.id} value={camera.id}>
                  {camera.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            onClick={isScanning ? stopScanning : startScanning}
            variant={isScanning ? "destructive" : "default"}
            className={isScanning ? "" : "bg-cyan-500 hover:bg-cyan-600"}
            disabled={!selectedCamera || isProcessing}
          >
            {isScanning ? (
              <>
                <CameraOff className="h-4 w-4 mr-2" />
                Detener
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 mr-2" />
                Iniciar
              </>
            )}
          </Button>
        </div>

        {/* Área del scanner */}
        <div 
          ref={containerRef}
          className="relative rounded-lg overflow-hidden bg-black/50 min-h-[300px]"
        >
          <div id="qr-reader" className="w-full" />
          
          {!isScanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <Camera className="h-16 w-16 mb-4 opacity-50" />
              <p>Presiona "Iniciar" para activar la cámara</p>
            </div>
          )}
          
          {isProcessing && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
            </div>
          )}
        </div>

        {/* Feedback del último escaneo */}
        {lastResult && (
          <div 
            className={`p-4 rounded-lg flex items-center gap-3 ${
              lastResult.success 
                ? "bg-emerald-500/20 border border-emerald-500/30" 
                : "bg-red-500/20 border border-red-500/30"
            }`}
          >
            {lastResult.success ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0" />
            )}
            <div>
              <p className={`font-medium ${lastResult.success ? "text-emerald-300" : "text-red-300"}`}>
                {lastResult.success ? "Check-in exitoso" : "Check-in fallido"}
              </p>
              <p className="text-sm text-slate-400">{lastResult.message}</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-500/20 rounded-lg border border-red-500/30 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Instrucciones */}
        <div className="text-sm text-slate-400 space-y-1">
          <p>📱 Apunta la cámara al código QR del boleto</p>
          <p>🔊 Escucharás una vibración al escanear</p>
          <p>⏱️ Espera 2 segundos entre escaneos del mismo código</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default QRScanner;
