import React from 'react';
import './Ornaments.css';

const Arch = ({ className }) => (
  <svg className={className} viewBox="0 0 200 300" fill="none" aria-hidden="true">
    <path d="M10 300V100a90 90 0 0 1 180 0v200" stroke="currentColor" strokeWidth="1.2" />
    <path d="M26 300V104a74 74 0 0 1 148 0v196" stroke="currentColor" strokeWidth="0.6" opacity="0.6" />
  </svg>
);
const Spark = ({ className }) => (
  <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
    <path d="M20 0c1.6 10.4 9.6 18.4 20 20-10.4 1.6-18.4 9.6-20 20-1.6-10.4-9.6-18.4-20-20C10.4 18.4 18.4 10.4 20 0Z" fill="currentColor" />
  </svg>
);

/**
 * Gold accents that float at different depths behind a hero's content: arch outlines,
 * sparkles and soft orbs. Each layer scrolls at its own speed (data-depth) and leans
 * toward the pointer (data-mouse), which reads as depth without any heavy 3D.
 */
const Ornaments = ({ variant = 'hero' }) => (
  <div className={`orn orn--${variant}`} aria-hidden="true">
    <div className="orn__layer" data-depth="0.12" data-mouse="10"><Arch className="orn__arch orn__arch--a" /></div>
    <div className="orn__layer" data-depth="0.3" data-mouse="22"><Arch className="orn__arch orn__arch--b" /></div>
    <div className="orn__layer" data-depth="0.5" data-mouse="34">
      <Spark className="orn__spark orn__spark--1" />
      <Spark className="orn__spark orn__spark--2" />
      <Spark className="orn__spark orn__spark--3" />
    </div>
    <div className="orn__layer" data-depth="0.22" data-mouse="-18">
      <span className="orn__orb orn__orb--1" />
      <span className="orn__orb orn__orb--2" />
    </div>
  </div>
);

export default Ornaments;
