/**
 * ZoomControls Component
 * 
 * Controles de zoom para el canvas.
 * 
 * Incluye:
 * - Botones +/- para zoom
 * - Slider para zoom continuo
 * - Porcentaje clickeable (reset a 100%)
 * - Botón fit-to-screen
 * - Presets de zoom rápido
 */

import React, { useState } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useZoomController } from '@/hooks/useZoomController';
import { ZOOM_CONFIG } from '@/lib/canvas-constants';
import { cn } from '@/lib/utils';

interface ZoomControlsProps {
  /** Clase CSS adicional */
  className?: string;
  /** Variante visual */
  variant?: 'default' | 'minimal' | 'floating';
  /** Mostrar slider */
  showSlider?: boolean;
  /** Mostrar presets dropdown */
  showPresets?: boolean;
}

export function ZoomControls({ 
  className,
  variant = 'default',
  showSlider = true,
  showPresets = true,
}: ZoomControlsProps) {
  const { 
    zoomLevel, 
    zoomPercentage,
    handleZoomIn, 
    handleZoomOut, 
    handleFitToScreen,
    handleZoom100,
    handleZoomToPreset,
    zoomToCenter,
  } = useZoomController();

  const [isSliderActive, setIsSliderActive] = useState(false);

  const isMinZoom = zoomLevel <= ZOOM_CONFIG.MIN;
  const isMaxZoom = zoomLevel >= ZOOM_CONFIG.MAX;

  /**
   * Presets de zoom disponibles
   */
  const zoomPresets = [
    { label: '25%', value: 0.25 },
    { label: '50%', value: 0.5 },
    { label: '75%', value: 0.75 },
    { label: '100%', value: 1 },
    { label: '150%', value: 1.5 },
    { label: '200%', value: 2 },
    { label: '300%', value: 3 },
  ];

  /**
   * Estilos por variante
   */
  const variantStyles = {
    default: 'bg-black/60 backdrop-blur-sm rounded-lg p-1',
    minimal: 'bg-transparent',
    floating: 'bg-black/80 backdrop-blur-md rounded-xl p-2 shadow-lg border border-white/10',
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn(
        'flex items-center gap-1',
        variantStyles[variant],
        className
      )}>
        {/* Zoom Out Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 text-white/80 hover:text-white hover:bg-white/20',
                isMinZoom && 'opacity-50 cursor-not-allowed'
              )}
              onClick={handleZoomOut}
              disabled={isMinZoom}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Zoom Out <kbd className="ml-2 text-xs opacity-60">Ctrl -</kbd></p>
          </TooltipContent>
        </Tooltip>

        {/* Slider */}
        {showSlider && (
          <div 
            className={cn(
              'w-24 px-2 transition-all duration-200',
              isSliderActive && 'w-32'
            )}
          >
            <Slider
              value={[zoomLevel * 100]}
              min={ZOOM_CONFIG.MIN * 100}
              max={ZOOM_CONFIG.MAX * 100}
              step={5}
              onValueChange={([val]) => zoomToCenter(val / 100)}
              onPointerDown={() => setIsSliderActive(true)}
              onPointerUp={() => setIsSliderActive(false)}
              className="cursor-pointer"
            />
          </div>
        )}

        {/* Zoom In Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 text-white/80 hover:text-white hover:bg-white/20',
                isMaxZoom && 'opacity-50 cursor-not-allowed'
              )}
              onClick={handleZoomIn}
              disabled={isMaxZoom}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Zoom In <kbd className="ml-2 text-xs opacity-60">Ctrl +</kbd></p>
          </TooltipContent>
        </Tooltip>

        {/* Porcentaje / Presets Dropdown */}
        {showPresets ? (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-8 px-2 text-white/80 hover:text-white hover:bg-white/20 text-xs font-mono min-w-[60px] gap-1"
                  >
                    {zoomPercentage}%
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Seleccionar zoom</p>
              </TooltipContent>
            </Tooltip>
            
            <DropdownMenuContent align="center" className="min-w-[120px]">
              {zoomPresets.map((preset) => (
                <DropdownMenuItem
                  key={preset.value}
                  onClick={() => handleZoomToPreset(preset.value)}
                  className={cn(
                    'justify-center font-mono',
                    Math.abs(zoomLevel - preset.value) < 0.01 && 'bg-accent'
                  )}
                >
                  {preset.label}
                </DropdownMenuItem>
              ))}
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem
                onClick={handleFitToScreen}
                className="justify-center"
              >
                <Maximize className="h-4 w-4 mr-2" />
                Ajustar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 px-2 text-white/80 hover:text-white hover:bg-white/20 text-xs font-mono min-w-[50px]"
                onClick={handleZoom100}
              >
                {zoomPercentage}%
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Reset a 100% <kbd className="ml-2 text-xs opacity-60">Ctrl 1</kbd></p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Fit to Screen Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
              onClick={handleFitToScreen}
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Ajustar a pantalla <kbd className="ml-2 text-xs opacity-60">Ctrl 0</kbd></p>
          </TooltipContent>
        </Tooltip>

        {/* Reset View (solo en variant floating) */}
        {variant === 'floating' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
                onClick={() => {
                  handleZoom100();
                }}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Resetear vista</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

export default ZoomControls;
