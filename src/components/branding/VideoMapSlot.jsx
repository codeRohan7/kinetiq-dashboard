import React, { useState, useEffect } from 'react';
import { Youtube, Check, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toYouTubeEmbedUrl } from '../../lib/brandingSchema';

/**
 * One YouTube link per foot type.
 *
 * Vendors paste whatever the YouTube share button gave them — watch?v=,
 * youtu.be/, /shorts/ — so the input is normalised to an /embed/ URL before it
 * is stored. KinetiQE drops the stored value straight into an <iframe src>, so
 * anything that isn't a recognisable YouTube id is rejected here rather than
 * silently rendering a blank player on the scanner.
 */
export default function VideoMapSlot({ slot, value, keys, labels, onChange, disabled }) {
  const map = value || {};
  const [drafts, setDrafts] = useState({});

  // Re-seed the inputs whenever the saved value changes underneath us.
  useEffect(() => {
    const saved = value || {};
    setDrafts(keys.reduce((acc, k) => ({ ...acc, [k]: saved[k] || '' }), {}));
  }, [value, keys]);

  const commit = (key) => {
    const raw = (drafts[key] || '').trim();
    if (!raw) {
      onChange({ ...map, [key]: null });
      return;
    }
    const embed = toYouTubeEmbedUrl(raw);
    if (!embed) return; // invalid — leave the draft so they can fix it
    onChange({ ...map, [key]: embed });
  };

  return (
    <section className="rounded-2xl border border-purple-100 bg-white/70 p-5">
      <div className="mb-3">
        <h3 className="font-semibold text-gray-800">{slot.label}</h3>
        <p className="text-sm text-gray-500 mt-0.5">{slot.help}</p>
      </div>

      <div className="space-y-4">
        {keys.map((key) => {
          const draft = drafts[key] ?? '';
          const saved = map[key] || null;
          const parsed = draft.trim() ? toYouTubeEmbedUrl(draft) : null;
          const invalid = draft.trim() !== '' && !parsed;
          const dirty = (parsed || null) !== saved && !(draft.trim() === '' && !saved);

          return (
            <div key={key}>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                {labels[key]}
              </label>

              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <div className="relative">
                    <Youtube
                      size={16}
                      className={`absolute left-3 top-1/2 -translate-y-1/2 ${saved ? 'text-red-500' : 'text-gray-300'}`}
                    />
                    <Input
                      value={draft}
                      disabled={disabled}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className={`pl-9 ${invalid ? 'border-red-300 focus-visible:ring-red-300' : ''}`}
                      onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(key); } }}
                    />
                  </div>

                  {invalid && (
                    <p className="text-xs text-red-500 mt-1">
                      That doesn't look like a YouTube link.
                    </p>
                  )}
                  {!invalid && parsed && (
                    <p className="text-xs text-gray-400 mt-1 break-all">Will be saved as {parsed}</p>
                  )}
                </div>

                <Button
                  type="button"
                  size="sm"
                  disabled={disabled || invalid || !dirty}
                  onClick={() => commit(key)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shrink-0"
                >
                  <Check size={14} className="mr-1" />
                  Save
                </Button>

                {saved && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => { setDrafts((d) => ({ ...d, [key]: '' })); onChange({ ...map, [key]: null }); }}
                    className="border-purple-200 shrink-0"
                    aria-label={`Clear ${labels[key]} video`}
                  >
                    <X size={14} />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
