import { useRef } from 'react';
import { useSnapScroll, getSectionTop } from '../../hooks/useSnapScroll.js';
import { templeBenefits } from './templeBenefits.js';
import { useTempleFlight } from './useTempleFlight.js';

const splitWords = (text) =>
  text.split(' ').flatMap((word, i) => [
    i > 0 ? ' ' : null,
    <span key={i} className="temple__word">
      <span>{word}</span>
    </span>,
  ]);

// Home "Why millets" scroll-frame temple section (original `hf`).
export default function TempleSection() {
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);

  useTempleFlight(sectionRef, canvasRef);

  useSnapScroll(sectionRef, (direction, scrollY) => {
    const section = sectionRef.current;
    if (!section) return null;
    const top = getSectionTop(section);
    const bottom = top + section.offsetHeight;
    const entryTop = Math.round(section.getBoundingClientRect().top + scrollY - window.innerHeight);
    const at = (y) => Math.abs(scrollY - y) <= 2;
    return direction > 0
      ? at(top)
        ? bottom
        : scrollY > entryTop - 2 && scrollY < top
          ? top
          : scrollY > top && scrollY < bottom - 2
            ? bottom
            : null
      : at(top)
        ? entryTop
        : scrollY > top && scrollY <= bottom + window.innerHeight * 0.25
          ? top
          : scrollY > entryTop + 2 && scrollY < top
            ? entryTop
            : null;
  });

  return (
    <section
      className="temple"
      ref={sectionRef}
      aria-label="A flight over the Brihadeeswarar temple, Thanjavur"
    >
      <div className="temple__stage">
        <canvas className="temple__canvas" ref={canvasRef} aria-hidden="true" />
        <div className="temple__vignette" aria-hidden="true" />
        <div className="temple__dim" aria-hidden="true" />
        <div className="temple__intro">
          <span className="temple__intro-kicker">Why millets</span>
          <h2 className="temple__intro-title">
            {splitWords('Grains our grandparents ate, for a reason.')}
          </h2>
          <span className="temple__intro-rule" aria-hidden="true" />
        </div>
        <div className="temple__heading">
          <h2 className="temple__heading-title">{splitWords('Why Millets')}</h2>
          <span className="temple__heading-rule" aria-hidden="true" />
        </div>
        <div className="temple__benefits">
          <ul className="temple__cards">
            {templeBenefits.map((benefit) => (
              <li key={benefit.n} className="temple__card">
                <span className="temple__card-n" aria-hidden="true">
                  {benefit.n}
                </span>
                <div className="temple__card-body">
                  <h3 className="temple__card-title">{benefit.title}</h3>
                  <p className="temple__card-measure">{benefit.measure}</p>
                  <p className="temple__card-text">{benefit.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="temple__progress" aria-hidden="true">
          <span className="temple__progress-fill" />
        </div>
      </div>
    </section>
  );
}
