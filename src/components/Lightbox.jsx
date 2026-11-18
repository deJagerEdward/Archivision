import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { downloadImage, extFor } from './ResultCard.jsx';

export default function Lightbox({ item, onClose, onPrev, onNext, projectSlug }) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose, onPrev, onNext]);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col bg-ink/92 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="flex items-center justify-between px-6 py-4 text-paper" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="micro-label !text-paper/50">{item.task.index} · {item.task.meta}</p>
              <p className="text-lg font-bold tracking-tight">{item.task.title}</p>
            </div>
            <div className="flex gap-2">
              <button
                className="grid size-10 place-items-center rounded-full border border-paper/20 hover:bg-paper hover:text-ink"
                onClick={() => downloadImage(item.result.dataUrl, `${projectSlug}-${item.task.index}-${item.task.id}.${extFor(item.result.mimeType)}`)}
                title="Download"
              >
                <Download className="size-4" />
              </button>
              <button className="grid size-10 place-items-center rounded-full border border-paper/20 hover:bg-paper hover:text-ink" onClick={onClose} title="Close">
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-16 pb-8">
            <button
              className="absolute left-4 grid size-11 place-items-center rounded-full bg-paper/10 text-paper hover:bg-paper hover:text-ink"
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              title="Previous"
            >
              <ChevronLeft className="size-5" />
            </button>
            <motion.img
              key={item.task.id}
              src={item.result.dataUrl}
              alt={item.task.title}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="max-h-full max-w-full rounded-[1.25rem] bg-white object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute right-4 grid size-11 place-items-center rounded-full bg-paper/10 text-paper hover:bg-paper hover:text-ink"
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              title="Next"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
