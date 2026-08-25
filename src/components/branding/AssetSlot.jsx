import React, { useRef, useState } from 'react';
import { Upload, Trash2, FileText, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';

/**
 * The three editors the Media tab is built from.
 *
 * All of them are controlled: they never touch Firestore themselves, they call
 * back with the new slot value and let VendorSettings persist it. That keeps
 * the "upload the file, then write the doc, then roll back the file if the
 * write fails" ordering in exactly one place.
 */

const ACCEPT_ATTR = {
  image: 'image/jpeg,image/png,image/webp,image/gif,image/avif',
  pdf: 'application/pdf',
};

/** Thumbnail with a remove button; renders a document chip for PDFs. */
function AssetTile({ asset, kind, onRemove, onMoveLeft, onMoveRight, disabled }) {
  return (
    <div className="relative group rounded-xl overflow-hidden border border-purple-100 bg-white">
      {kind === 'pdf' ? (
        <a
          href={asset.url}
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center justify-center h-28 gap-2 text-purple-600 hover:bg-purple-50"
        >
          <FileText size={28} />
          <span className="text-xs font-medium">View PDF</span>
        </a>
      ) : (
        <img src={asset.url} alt="" className="h-28 w-full object-cover" />
      )}

      <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/45 opacity-0 group-hover:opacity-100 transition">
        <div className="flex">
          {onMoveLeft && (
            <button type="button" disabled={disabled} onClick={onMoveLeft}
              className="p-1.5 text-white hover:bg-white/20 disabled:opacity-40" aria-label="Move earlier">
              <ArrowLeft size={14} />
            </button>
          )}
          {onMoveRight && (
            <button type="button" disabled={disabled} onClick={onMoveRight}
              className="p-1.5 text-white hover:bg-white/20 disabled:opacity-40" aria-label="Move later">
              <ArrowRight size={14} />
            </button>
          )}
        </div>
        <button type="button" disabled={disabled} onClick={onRemove}
          className="p-1.5 text-white hover:bg-red-500/80 disabled:opacity-40" aria-label="Remove">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function SlotHeader({ slot, count }) {
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-gray-800">{slot.label}</h3>
        {count !== undefined && (
          <span className="text-xs text-gray-500 tabular-nums">
            {count} of {slot.cap} used
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mt-0.5">{slot.help}</p>
    </div>
  );
}

/** Ordered list of images, capped at slot.cap. */
export function ImageListSlot({ slot, value, onUpload, onChange, disabled }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const items = value || [];
  const full = items.length >= slot.cap;

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    const room = slot.cap - items.length;
    if (files.length > room) {
      toast.warning(`Only ${room} more image${room === 1 ? '' : 's'} fit here — taking the first ${room}.`);
    }

    setBusy(true);
    try {
      await onUpload(files.slice(0, room));
    } finally {
      setBusy(false);
    }
  };

  const move = (from, to) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <section className="rounded-2xl border border-purple-100 bg-white/70 p-5">
      <SlotHeader slot={slot} count={items.length} />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {items.map((asset, i) => (
          <AssetTile
            key={asset.path || asset.url || i}
            asset={asset}
            kind="image"
            disabled={disabled || busy}
            onRemove={() => onChange(items.filter((_, idx) => idx !== i))}
            onMoveLeft={i > 0 ? () => move(i, i - 1) : undefined}
            onMoveRight={i < items.length - 1 ? () => move(i, i + 1) : undefined}
          />
        ))}

        {!full && (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className="h-28 rounded-xl border-2 border-dashed border-purple-200 text-purple-500 hover:border-purple-400 hover:bg-purple-50 flex flex-col items-center justify-center gap-1 disabled:opacity-50"
          >
            {busy
              ? <Loader2 size={20} className="animate-spin" />
              : <><Upload size={20} /><span className="text-xs font-medium">Add image</span></>}
          </button>
        )}
      </div>

      {full && (
        <p className="text-xs text-gray-400 mt-3">
          All {slot.cap} slots are filled — remove one to add a different image.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR.image}
        multiple
        className="hidden"
        onChange={handleFiles}
      />
    </section>
  );
}

/** A single image, e.g. the molding centre logo. */
export function SingleImageSlot({ slot, value, onUpload, onChange, disabled }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      await onUpload([file]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-purple-100 bg-white/70 p-5">
      <SlotHeader slot={slot} />

      <div className="flex items-center gap-4">
        {value ? (
          <div className="w-40">
            <AssetTile
              asset={value}
              kind="image"
              disabled={disabled || busy}
              onRemove={() => onChange(null)}
            />
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className="h-28 w-40 rounded-xl border-2 border-dashed border-purple-200 text-purple-500 hover:border-purple-400 hover:bg-purple-50 flex flex-col items-center justify-center gap-1 disabled:opacity-50"
          >
            {busy
              ? <Loader2 size={20} className="animate-spin" />
              : <><Upload size={20} /><span className="text-xs font-medium">Upload logo</span></>}
          </button>
        )}

        {value && (
          <Button
            type="button"
            variant="outline"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className="border-purple-200 hover:bg-purple-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin mr-2" /> : <Upload size={16} className="mr-2" />}
            Replace
          </Button>
        )}
      </div>

      <input ref={inputRef} type="file" accept={ACCEPT_ATTR.image} className="hidden" onChange={handleFile} />
    </section>
  );
}

/** One PDF per foot type. */
export function PdfMapSlot({ slot, value, keys, labels, onUpload, onChange, disabled }) {
  const [busyKey, setBusyKey] = useState(null);
  const inputRefs = useRef({});
  const map = value || {};

  const handleFile = async (key, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusyKey(key);
    try {
      await onUpload(key, file);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="rounded-2xl border border-purple-100 bg-white/70 p-5">
      <SlotHeader slot={slot} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {keys.map((key) => (
          <div key={key}>
            <p className="text-sm font-medium text-gray-700 mb-2">{labels[key]}</p>
            {map[key] ? (
              <AssetTile
                asset={map[key]}
                kind="pdf"
                disabled={disabled || busyKey === key}
                onRemove={() => onChange({ ...map, [key]: null })}
              />
            ) : (
              <button
                type="button"
                disabled={disabled || busyKey === key}
                onClick={() => inputRefs.current[key]?.click()}
                className="h-28 w-full rounded-xl border-2 border-dashed border-purple-200 text-purple-500 hover:border-purple-400 hover:bg-purple-50 flex flex-col items-center justify-center gap-1 disabled:opacity-50"
              >
                {busyKey === key
                  ? <Loader2 size={20} className="animate-spin" />
                  : <><Upload size={20} /><span className="text-xs font-medium">Upload PDF</span></>}
              </button>
            )}
            <input
              ref={(el) => { inputRefs.current[key] = el; }}
              type="file"
              accept={ACCEPT_ATTR.pdf}
              className="hidden"
              onChange={(e) => handleFile(key, e)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
