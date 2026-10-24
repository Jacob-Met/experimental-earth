import test from 'node:test';
import assert from 'node:assert/strict';
import {pondedInfiltration,advanceWettingFront} from '../wetting-front.js';
// Independent100digit Decimal integral oracle; authored numerical evidence, not field data.
const controls=[
  {
    "input": [
      8.936380638682942e-06,
      0.09884700906916068,
      0.024978138520315246,
      4.155565666107599e-05
    ],
    "expected": 0.0004468887662388026
  },
  {
    "input": [
      4.739916483732099e-19,
      0.5988644246054508,
      0.00026775463981293173,
      1.7829169025368862e-07
    ],
    "expected": 7.63294178131626e-06
  },
  {
    "input": [
      8.464000537582469e-16,
      1.8503645492464874e-08,
      1.855148689010627e-12,
      4.508826324129517e-08
    ],
    "expected": 5.5354883137541764e-14
  },
  {
    "input": [
      0.0,
      3.526251697758421e-11,
      1.0833446111811209e-06,
      2.195565233704555
    ],
    "expected": 1.3003406060912997e-08
  },
  {
    "input": [
      2.95743272169098e-20,
      2.283184939089733e-06,
      2.0235453206614452e-15,
      9.24553870553538e-14
    ],
    "expected": 2.933994559657555e-17
  },
  {
    "input": [
      8.564230834777148e-12,
      3.19394560758997e-06,
      1.0752331651527818e-05,
      0.0007089666423868174
    ],
    "expected": 2.2217345242362374e-07
  },
  {
    "input": [
      0.0014848372428476807,
      9.925878441658458e-08,
      22.74176042988708,
      2.3073811464732276e-05
    ],
    "expected": 3.507977062645605e-08
  },
  {
    "input": [
      3.6988313225896403e-13,
      17.396572762079334,
      1.6975488014545719,
      6.664784238840708e-05
    ],
    "expected": 0.06351627270987627
  },
  {
    "input": [
      0.0,
      0.00010128143854264672,
      1.3882981578821436e-10,
      2.266911955799059e-10
    ],
    "expected": 2.5401972605666342e-12
  },
  {
    "input": [
      3.981641324378395e-08,
      0.5333331326148416,
      2.8810831613942693,
      0.004888455779809827
    ],
    "expected": 0.124312464778978
  },
  {
    "input": [
      3.6933774570220445e-18,
      4.6086889605681737e-14,
      1.6727525150467317e-13,
      0.0007098178763753343
    ],
    "expected": 3.3263629615959194e-15
  },
  {
    "input": [
      0.10259236776494823,
      7.013681025046062,
      24.698602458089244,
      0.007874932440621145
    ],
    "expected": 1.5895120956148256
  }
];
test('safeguarded inversion preserves difficult independent high-precision roots',()=>{for(const c of controls){const got=pondedInfiltration(...c.input);assert.ok(Math.abs(got-c.expected)<=1e-12*Math.abs(c.expected),JSON.stringify({c,got}));}});
test('tiny conductivities and large prior infiltration remain finite, monotone and supply bounded',()=>{for(const K of [1e-14,1e-8,1,2000])for(const F of [0,1e-18,1e9])for(const A of [0,1e-12,5000]){let previous=0;for(const hours of [1e-12,1e-6,1,12]){const r=advanceWettingFront({cumulativeMm:F,surfaceWaterMm:2,rainMmHr:20,hours,conductivityMmHr:K,capillaryDriveMm:A});assert.ok(Number.isFinite(r.infiltratedMm));assert.ok(r.infiltratedMm>=previous);assert.ok(r.infiltratedMm<=2+20*hours);previous=r.infiltratedMm;}}});
