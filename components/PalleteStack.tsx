'use client'
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { cn } from "../lib/utils";

const CARDS = [
  {
    title    : "Unforgettable",
    subtitle : "For memories",
    color    : "#EB4C4C",
  },
  {
    title    : "Instant Prints",
    subtitle : "Take it home",
    color    : "#FF7070",
  },
  {
    title    : "Big Smiles",
    subtitle : "Capture the fun",
    color    : "#FFA6A6",
  },
  {
    title    : "3... 2... 1...",
    subtitle : "Get ready",
    color    : "#FFEDC7",
  },
];

export default function PalleteStack( {
  className,
}: {
  className?: string;
} ) {
  const cardsRef = useRef<HTMLDivElement[]>( [] );

  const STACK_WIDTH = 50;
  const OVERLAP = 18;

  useEffect( () => {
    const cards = cardsRef.current;
    const total = cards.length;

    // Initial stacked state
    cards.forEach( ( card, index ) => {
      gsap.set( card, {
        width    : `${STACK_WIDTH}%`,
        right    : 0,
        xPercent : -( total - 1 - index ) * OVERLAP,
        zIndex   : index + 1,
      } );
    } );

    const tl = gsap.timeline( {
      repeat   : -1,
      defaults : {
        ease : "power3.inOut",
      },
    } );

    // Hold stacked
    tl.to( {}, { duration : 2.5 } );
    tl.addLabel( "expand" );

    // Expand
    cards.forEach( ( card, index ) => {
      tl.to(
        card,
        {
          width    : `${( 100 / total ) + 3}%`,
          right    : `${( index * ( 100 / total ) )}%`,
          xPercent : 0,
          duration : 0.8,
        },
        `expand+=${index * 0.08}`
      );
    } );

    // Hold expanded
    tl.to( {}, { duration : 2.5 } );

    // Collapse back (reverse order looks nicer)
    cards.toReversed().forEach( ( card, reverseIndex ) => {
      const index = total - reverseIndex - 1;

      tl.to(
        card,
        {
          width    : `${STACK_WIDTH}%`,
          right    : 0,
          xPercent : -( total - 1 - index ) * OVERLAP,
          duration : 0.8,
        },
        `>-0.5+${reverseIndex * 0.08}`
      );
    } );

    return () => {
      tl.kill();
    };
  }, [] );

  return (
    <div
      className={cn(
        "relative h-full overflow-hidden rounded-3xl",
        className
      )}
    >
      {CARDS.map( ( card, index ) => (
        <div
          key={card.title}
          ref={( el ) => {
            if ( el ) cardsRef.current[index] = el;
          }}
          className="absolute top-0 bottom-0 rounded-3xl"
          style={{
            backgroundColor : card.color,
            // width           : `${STACK_WIDTH}%`,
            // right           : 0,
            // transform       : `translateX(${-( CARDS.length - 1 - index ) * OVERLAP}%)`,
            // zIndex          : index + 1,
          }}
        >
          <div
            className={cn(
              "absolute left-8 top-1/2",
              "origin-left whitespace-nowrap",
              card.color === "#FFEDC7"
                ? "text-neutral-700"
                : "text-white"
            )}
          >
            <div className="font-semibold">{card.title}</div>
            <div className="text-sm opacity-80">{card.subtitle}</div>
          </div>
        </div>
      ) )}
    </div>
  );
}