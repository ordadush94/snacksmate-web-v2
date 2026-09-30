type DeviceFrameProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  eager?: boolean;
  className?: string;
};

export function DeviceFrame({
  src,
  alt,
  width,
  height,
  priority = false,
  eager = false,
  className,
}: DeviceFrameProps) {
  return (
    <div className={className ? `device ${className}` : "device"}>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority || eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
      />
    </div>
  );
}
