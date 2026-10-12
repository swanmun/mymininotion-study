export default function Avatar({ src, size }: { src: string | null; size: number }) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, ...(src ? { backgroundImage: `url("${src}")` } : null) }}
      aria-hidden="true"
    />
  );
}
