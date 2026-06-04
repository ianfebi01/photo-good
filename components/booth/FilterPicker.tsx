import type { Shot } from '@/store/boothStore'
import { cn } from '@/lib/utils'
import { filtersList, getCSSFilter } from './filters'

interface FilterPickerProps {
  photos: Shot[]
  pending: Shot | null
  activePhoto: Shot | null
  globalFilter: string
  onFilterChange: ( filter: string ) => void
}

export function FilterPicker( {
  photos,
  pending,
  activePhoto,
  globalFilter,
  onFilterChange,
}: FilterPickerProps ) {
  const previewUrl = activePhoto?.url ?? photos[0]?.url ?? pending?.url
  const hasPhoto = photos.length > 0 || !!pending

  return (
    <div className="flex flex-row items-center gap-6 w-full h-full">
      <div className="flex flex-col gap-1.5 flex-2 justify-center h-full overflow-hidden">
        <div className="flex flex-col xl:flex-row gap-2 overflow-auto scrollbar-none h-full xl:items-center">
          {filtersList.map( ( f ) => (
            <button
              key={f.name}
              type="button"
              onClick={() => onFilterChange( f.name )}
              className={cn(
                'flex flex-col gap-1 text-center transition cursor-pointer select-none xl:h-full xl:w-fit!',
                globalFilter === f.name ? 'bg-primary/2 text-black' : 'text-neutral-500',
              )}
            >
              {hasPhoto ? (
                <div className="aspect-3/2 w-full xl:h-full overflow-hidden rounded-md bg-accent relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={f.label}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ filter : getCSSFilter( f.name ) }}
                  />
                </div>
              ) : (
                <div className="aspect-4/3 h-full overflow-hidden rounded-md bg-accent relative flex items-center justify-center text-white">
                  {f.label}
                </div>
              )}
              <span className="text-[9px] font-bold truncate w-full">
                {f.label}
              </span>
            </button>
          ) )}
        </div>
      </div>
    </div>
  )
}
