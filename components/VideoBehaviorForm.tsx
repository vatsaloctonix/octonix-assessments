"use client";

import { useState } from "react";
import { Button, Input, TinyLabel } from "./ui";
import type { VideoBehaviorEvaluation } from "@/lib/types";

export function VideoBehaviorForm(props: {
  value: VideoBehaviorEvaluation;
  onChange: (value: VideoBehaviorEvaluation) => void;
  onSave: () => void;
}) {
  const { value, onChange } = props;
  const [customWord, setCustomWord] = useState("");

  const updateRepWords = (field: string, count: number) => {
    onChange({
      ...value,
      repetitiveWords: { ...value.repetitiveWords, [field]: Math.max(0, count) },
    });
  };

  const addCustomWord = () => {
    if (!customWord.trim()) return;
    const custom = value.repetitiveWords?.custom || [];
    onChange({
      ...value,
      repetitiveWords: {
        ...value.repetitiveWords,
        custom: [...custom, { word: customWord, count: 0 }],
      },
    });
    setCustomWord("");
  };

  return (
    <div className="space-y-6 rounded-2xl border-2 border-purple-200 bg-purple-50 p-6">
      <div className="text-base font-bold text-purple-900">📊 Video Behavior Evaluation</div>

      {/* Repetitive Words */}
      <div className="rounded-lg bg-white p-4">
        <TinyLabel>Repetitive Words (lower = better)</TinyLabel>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {[
            { key: "like", label: "like" },
            { key: "youKnow", label: "you know" },
            { key: "uhh", label: "uhh" },
            { key: "ummm", label: "ummm" },
          ].map((word) => (
            <div key={word.key} className="flex items-center gap-2">
              <span className="text-xs">{word.label}:</span>
              <button onClick={() => updateRepWords(word.key, (value.repetitiveWords?.[word.key as keyof typeof value.repetitiveWords] as number || 0) - 1)} className="rounded bg-red-100 px-2 py-1 text-xs">-</button>
              <span className="font-mono text-sm">{(value.repetitiveWords?.[word.key as keyof typeof value.repetitiveWords] as number) || 0}</span>
              <button onClick={() => updateRepWords(word.key, (value.repetitiveWords?.[word.key as keyof typeof value.repetitiveWords] as number || 0) + 1)} className="rounded bg-green-100 px-2 py-1 text-xs">+</button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Input value={customWord} onChange={(e) => setCustomWord(e.target.value)} placeholder="Other word..." className="flex-1 text-sm" />
          <Button onClick={addCustomWord} className="text-xs">Add</Button>
        </div>
        {value.repetitiveWords?.custom?.map((item, i) => (
          <div key={i} className="mt-2 flex items-center gap-2 text-xs">
            <span>{item.word}:</span>
            <button onClick={() => {
              const custom = [...value.repetitiveWords!.custom!];
              custom[i].count = Math.max(0, custom[i].count - 1);
              onChange({ ...value, repetitiveWords: { ...value.repetitiveWords, custom } });
            }} className="rounded bg-red-100 px-2 py-1">-</button>
            <span className="font-mono">{item.count}</span>
            <button onClick={() => {
              const custom = [...value.repetitiveWords!.custom!];
              custom[i].count++;
              onChange({ ...value, repetitiveWords: { ...value.repetitiveWords, custom } });
            }} className="rounded bg-green-100 px-2 py-1">+</button>
          </div>
        ))}
      </div>

      {/* Gap, Tone, Speed */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white p-4">
          <TinyLabel>Avg Gap (sec)</TinyLabel>
          <Input type="number" step="0.5" value={value.averageGapSeconds || ""} onChange={(e) => onChange({ ...value, averageGapSeconds: parseFloat(e.target.value) || undefined })} placeholder="1.5" className="mt-2 text-sm" />
        </div>
        <div className="rounded-lg bg-white p-4">
          <TinyLabel>Tone</TinyLabel>
          <div className="mt-2 flex flex-wrap gap-1">
            {["calm", "confident", "nervous", "professional"].map((tone) => {
              const isSelected = value.tone?.includes(tone as any);
              return (
                <button key={tone} onClick={() => {
                  const current = value.tone || [];
                  onChange({ ...value, tone: isSelected ? current.filter((t) => t !== tone) : [...current, tone as any] });
                }} className={`rounded px-2 py-1 text-[10px] ${isSelected ? "bg-purple-500 text-white" : "bg-gray-200"}`}>
                  {tone}
                </button>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg bg-white p-4">
          <TinyLabel>Speed ({value.speed || 6}/10)</TinyLabel>
          <input type="range" min="0" max="10" value={value.speed || 6} onChange={(e) => onChange({ ...value, speed: parseInt(e.target.value) })} className="mt-2 w-full" />
        </div>
      </div>

      {/* Questions */}
      <div className="grid gap-3 md:grid-cols-2">
        {["A", "B"].map((q) => (
          <div key={q} className="rounded-lg bg-white p-3">
            <div className="mb-2 text-xs font-bold">Q{q}</div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={value[`question${q}` as "questionA"]?.partedInTwoHalves || false} onChange={(e) => onChange({ ...value, [`question${q}`]: { ...value[`question${q}` as "questionA"], partedInTwoHalves: e.target.checked } })} />
              Parted in 2 halves ✓
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={value[`question${q}` as "questionA"]?.handMovements || false} onChange={(e) => onChange({ ...value, [`question${q}`]: { ...value[`question${q}` as "questionA"], handMovements: e.target.checked } })} />
              Hand movements ✓
            </label>
          </div>
        ))}
        <div className="rounded-lg bg-white p-3">
          <div className="mb-2 text-xs font-bold">QC</div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={value.questionC?.startedSpeakingASAP || false} onChange={(e) => onChange({ ...value, questionC: { ...value.questionC, startedSpeakingASAP: e.target.checked } })} />
            Started ASAP ✓
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={value.questionC?.handMovements || false} onChange={(e) => onChange({ ...value, questionC: { ...value.questionC, handMovements: e.target.checked } })} />
            Hand movements ✓
          </label>
        </div>
        <div className="rounded-lg bg-white p-3">
          <div className="mb-2 text-xs font-bold">QD</div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={value.questionD?.partedInTwoQuestions || false} onChange={(e) => onChange({ ...value, questionD: { ...value.questionD, partedInTwoQuestions: e.target.checked } })} />
            Parted in 2 ✓
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={value.questionD?.talkedAboutImprovingWeakness || false} onChange={(e) => onChange({ ...value, questionD: { ...value.questionD, talkedAboutImprovingWeakness: e.target.checked } })} />
            Improving weakness ✓✓
          </label>
        </div>
        <div className="rounded-lg bg-white p-3">
          <div className="mb-2 text-xs font-bold">QE</div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={value.questionE?.thoughtBeforeAnswering || false} onChange={(e) => onChange({ ...value, questionE: { ...value.questionE, thoughtBeforeAnswering: e.target.checked } })} />
            Thought first ✓
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={!(value.questionE?.saidItDepends ?? false)} onChange={(e) => onChange({ ...value, questionE: { ...value.questionE, saidItDepends: !e.target.checked } })} />
            No "it depends" ✓
          </label>
        </div>
      </div>

      <Button onClick={props.onSave} className="w-full">Save Evaluation</Button>
    </div>
  );
}
