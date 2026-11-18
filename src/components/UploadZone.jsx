import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageUp, X, RefreshCcw } from 'lucide-react';

export default function UploadZone({ image, onFile, onClear, disabled }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  function handleFiles(files) {
    const file = files?.[0];
    if (file && file.type.startsWith('image/')) onFile(file);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <AnimatePresence mode="wait" initial={false}>
        {image ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="group relative overflow-hidden rounded-[1.5rem] bg-white card-shadow"
            onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) handleFiles(e.dataTransfer.files); }}
          >
            <img src={image.dataUrl} alt="Uploaded sketch" className="block max-h-72 w-full object-contain bg-white" />
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight">{image.name}</p>
                <p className="micro-label !text-[0.75rem]">
                  {image.width} × {image.height} px · {(image.size / 1024).toFixed(0)} kb
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => inputRef.current?.click()}
                  className="grid size-9 place-items-center rounded-full border border-line text-ink transition hover:bg-paper disabled:opacity-40"
                  title="Replace image"
                >
                  <RefreshCcw className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onClear}
                  className="grid size-9 place-items-center rounded-full border border-line text-ink transition hover:bg-paper disabled:opacity-40"
                  title="Remove image"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            {over && <div className="pointer-events-none absolute inset-0 rounded-[1.5rem] ring-2 ring-olive ring-inset bg-olive/10" />}
          </motion.div>
        ) : (
          <motion.button
            key="drop"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files); }}
            className={`blueprint-grid relative flex w-full flex-col items-center justify-center gap-4 rounded-[1.5rem] border-[1.5px] border-dashed px-6 py-12 text-center transition-colors ${
              over ? 'border-olive bg-olive/10' : 'border-[#C9C7BA] bg-white/40 hover:border-ink/50 hover:bg-white/70'
            }`}
          >
            <motion.span
              animate={over ? { y: -4, scale: 1.06 } : { y: 0, scale: 1 }}
              className="grid size-14 place-items-center rounded-2xl bg-ink text-paper"
            >
              <ImageUp className="size-6" strokeWidth={1.75} />
            </motion.span>
            <span>
              <span className="block text-base font-semibold tracking-tight">Drop a sketch or massing model</span>
              <span className="mt-1 block text-sm text-stone">or click to browse · PNG, JPG, WEBP</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
