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
    <div className="sticky top-[68px] z-10 -mx-4 border-b border-emerald-100/50 bg-[#F6F8F5]/80 px-4 py-3 backdrop-blur-md">
      <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((category) => {
          const active = category.id === activeId;
          return (
            <button
              key={category.id}
              type="button"
              data-testid={`qr-category-${category.id}`}
              onClick={() => onSelect(category.id)}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-black transition ${
                active
                  ? "bg-slate-950 text-white shadow-md shadow-slate-900/15"
                  : "border border-white/80 bg-white/75 text-slate-700 shadow-sm backdrop-blur-sm"
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
