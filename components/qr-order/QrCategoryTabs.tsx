"use client";

export default function QrCategoryTabs({
  categories,
  activeId,
  onSelect,
  embedded = false,
}: {
  categories: Array<{ id: string; name: string }>;
  activeId: string;
  onSelect: (id: string) => void;
  /** When true, sits inside sticky header — no second sticky layer. */
  embedded?: boolean;
}) {
  const shell = embedded
    ? "pt-1"
    : "sticky top-[7.5rem] z-10 -mx-4 border-b border-emerald-100/50 bg-[#F6F8F5]/90 px-4 py-3 backdrop-blur-md sm:top-[8.25rem] sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-4 lg:backdrop-blur-none";

  return (
    <div className={shell}>
      <div
        className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2.5"
        role="tablist"
        aria-label="Menü kategorileri"
      >
        {categories.map((category) => {
          const active = category.id === activeId;
          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`qr-category-${category.id}`}
              onClick={() => onSelect(category.id)}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 hover:opacity-95 sm:px-5 ${
                active
                  ? "bg-slate-950 text-white shadow-md shadow-slate-900/15"
                  : "border border-white/80 bg-white/75 text-slate-700 shadow-sm backdrop-blur-sm hover:bg-white"
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
