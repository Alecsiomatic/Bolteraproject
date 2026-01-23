/**
 * SaveIndicator Component
 * 
 * Indicador visual del estado de guardado del canvas.
 * 
 * Estados:
 * - Guardando: Spinner + "Guardando..."
 * - Sin guardar: Icono warning + "Sin guardar"
 * - Guardado: Check + timestamp
 * - Error: Icono error + mensaje
 * - Sin cambios: Icono cloud + "Sin cambios"
 */

import React from 'react';
import { 
  Cloud, 
  CloudOff, 
  Loader2, 
  Check, 
  AlertCircle,
  RefreshCw 
} from 'lucide-react';
import { useSaveStatus } from '@/stores/canvasStore';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SaveIndicatorProps {
  /** Clase CSS adicional */
  className?: string;
  /** Mostrar versión compacta (solo icono) */
  compact?: boolean;
  /** Callback para reintentar guardado */
  onRetry?: () => void;
}

export function SaveIndicator({ 
  className, 
  compact = false,
  onRetry,
}: SaveIndicatorProps) {
  const { isDirty, isSaving, lastSavedAt, saveError } = useSaveStatus();

  /**
   * Formatea la fecha de último guardado
   */
  const formatTime = (date: Date | null): string => {
    if (!date) return 'Nunca';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Si es menos de 1 minuto, mostrar "Hace un momento"
    if (diff < 60000) {
      return 'Hace un momento';
    }
    
    // Si es menos de 1 hora, mostrar minutos
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `Hace ${minutes} min`;
    }
    
    // Si es hoy, mostrar hora
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('es-MX', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    
    // Si no, mostrar fecha y hora
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Determina el estado actual
   */
  const getState = () => {
    if (isSaving) return 'saving';
    if (saveError) return 'error';
    if (isDirty) return 'dirty';
    if (lastSavedAt) return 'saved';
    return 'idle';
  };

  const state = getState();

  /**
   * Configuración visual por estado
   */
  const stateConfig = {
    saving: {
      icon: Loader2,
      iconClass: 'animate-spin',
      text: 'Guardando...',
      bgClass: 'bg-blue-500/20',
      textClass: 'text-blue-400',
      tooltip: 'Guardando cambios en el servidor',
    },
    dirty: {
      icon: CloudOff,
      iconClass: '',
      text: 'Sin guardar',
      bgClass: 'bg-yellow-500/20',
      textClass: 'text-yellow-400',
      tooltip: 'Hay cambios sin guardar',
    },
    saved: {
      icon: Check,
      iconClass: '',
      text: `Guardado ${formatTime(lastSavedAt)}`,
      bgClass: 'bg-green-500/20',
      textClass: 'text-green-400',
      tooltip: lastSavedAt 
        ? `Último guardado: ${lastSavedAt.toLocaleString('es-MX')}`
        : 'Guardado',
    },
    error: {
      icon: AlertCircle,
      iconClass: '',
      text: 'Error al guardar',
      bgClass: 'bg-red-500/20',
      textClass: 'text-red-400',
      tooltip: saveError || 'Error al guardar',
    },
    idle: {
      icon: Cloud,
      iconClass: '',
      text: 'Sin cambios',
      bgClass: 'bg-gray-500/20',
      textClass: 'text-gray-400',
      tooltip: 'No hay cambios pendientes',
    },
  };

  const config = stateConfig[state];
  const Icon = config.icon;

  const content = (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
        config.bgClass,
        config.textClass,
        state === 'error' && onRetry && 'cursor-pointer hover:brightness-110',
        className
      )}
      onClick={state === 'error' && onRetry ? onRetry : undefined}
    >
      <Icon className={cn('h-3.5 w-3.5', config.iconClass)} />
      
      {!compact && (
        <span className="whitespace-nowrap">{config.text}</span>
      )}
      
      {/* Botón de retry para errores */}
      {state === 'error' && onRetry && !compact && (
        <RefreshCw className="h-3 w-3 ml-1 hover:rotate-180 transition-transform duration-300" />
      )}
    </div>
  );

  // Si es compacto, envolver en tooltip
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

export default SaveIndicator;
