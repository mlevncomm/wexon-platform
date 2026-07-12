"use client";

export default function QrCategoryTabs({
  categories,
  activeId,
  onSelect,
}: {
  categories: Array<{ id: string; name: string }>;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="sticky top-[64px] z-10 -mx-4 border-b border-slate-200/80 bg-[#f6f8f7]/95 px-4 py-3 backdrop-blur-xl">
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((category) => {
          const active = category.id === activeId;
          return (
            <button
              key={category.id}
              type="button"
              data-testid={`qr-category-${category.id}`}
              onClick={() => onSelect(category.id)}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold transition-colors ${
                active
                  ? "bg-slate-950 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              {category.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
