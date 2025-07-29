import React, { useState, useRef, useEffect } from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
  className?: string;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  className = '',
  minWidth = 300,
  maxWidth = 800,
  defaultWidth = 500,
}) => {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minWidth, maxWidth]);

  return (
    <div className={`relative ${className}`} style={{ width: `${width}px` }} ref={panelRef}>
      {children}
      <div
        className="absolute top-0 right-0 w-1 h-full bg-gray-600/40 hover:bg-blue-500/60 cursor-col-resize transition-all duration-200 group"
        onMouseDown={() => setIsResizing(true)}
      >
        <div className="absolute inset-y-0 -right-1 w-3 group-hover:bg-blue-500/10 transition-colors" />
      </div>
    </div>
  );
};