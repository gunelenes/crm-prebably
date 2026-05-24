export default function Spinner({ className = "" }) {
  return (
    <span
      className={`inline-block animate-spin border-2 border-current border-t-transparent rounded-full w-4 h-4 align-[-3px] ${className}`}
    />
  );
}
