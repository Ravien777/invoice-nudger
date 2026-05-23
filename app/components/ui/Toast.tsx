import toast from "react-hot-toast";

function styledToast(message: string, options?: any) {
  return toast.custom(
    (t) => (
      <div
        className={`bg-surface-secondary text-text-primary border border-border-default rounded-lg shadow-lg px-4 py-3 text-sm transition-all duration-300 ${
          t.visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {message}
      </div>
    ),
    { duration: 4000, ...options },
  );
}

styledToast.success = (msg: string, opts?: any) => toast.success(msg, opts);
styledToast.error = (msg: string, opts?: any) => toast.error(msg, opts);
styledToast.custom = toast.custom;

export { styledToast as toast };
