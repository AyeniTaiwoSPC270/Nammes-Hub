// Sample/placeholder course data. Swap for real Supabase-backed content once
// the department's outlines are scoped for the Admin CRUD flow.

export const LEVELS = ['100', '200', '300', '400', '500']

export const SEMESTER_LABELS = {
  1: 'First Semester',
  2: 'Second Semester',
}

export const outlines = {
  100: {
    1: [
      {
        code: 'MME 101',
        title: 'Introduction to Materials and Metallurgical Engineering',
        units: 2,
        lecturer: 'TBA',
        updated: 'Jul 10, 2026',
        description:
          'A broad orientation to the discipline — what materials and metallurgical engineers do, the industries they work in, and how the degree programme is structured.',
        topics: [
          'History and scope of materials and metallurgical engineering',
          'Overview of metals, ceramics, polymers and composites',
          'Career paths and professional bodies (NSE, NIMM)',
          'Basic laboratory safety and practice',
        ],
      },
      {
        code: 'MME 103',
        title: 'Engineering Drawing I',
        units: 2,
        lecturer: 'TBA',
        updated: 'Jul 08, 2026',
        description:
          'Fundamentals of technical drawing and orthographic projection as a communication tool for engineers.',
        topics: [
          'Drawing instruments and lettering',
          'Orthographic and isometric projection',
          'Sectioning and dimensioning',
          'Introduction to CAD sketching',
        ],
      },
    ],
    2: [
      {
        code: 'PHY-CM 102',
        title: 'Electricity & Magnetism',
        units: 2,
        lecturer: 'TBA',
        updated: 'Jul 23, 2026',
        description:
          'Core electricity and magnetism for engineers, from electrostatics through to AC circuits and Maxwell’s equations.',
        topics: [
          'Electrostatics – charge, properties, Coulomb’s law, superposition',
          'Electric field, potential, Gauss’s law',
          'Capacitance, energy, conductors and insulators, dipoles',
          'DC circuits – current, voltage, Ohm’s law, resistor combinations',
          'Magnetic fields – intro, Lorentz force, Biot-Savart law',
          'Ampère’s law, magnetic dipoles, dielectrics, energy',
          'Electromotive force, Faraday’s and Lenz’s law',
          'Self and mutual inductances, transformers',
          'AC circuits, Maxwell’s equations, EM oscillations and waves',
        ],
        texts: ['Adewale’s Physics Volume 2', 'University Physics Volume 2'],
      },
      {
        code: 'LAG-PHY 104',
        title: 'General Physics IV (Vibration, Waves and Optics)',
        units: 2,
        lecturer: 'TBA',
        updated: 'Jul 23, 2026',
        description:
          'Vibrations, waves and optics — from damped SHM and resonance through to wave propagation and the basics of modern physics.',
        topics: [
          'Energy in vibrating systems, damped SHM',
          'Resonance, transients, coupled SHM',
          'Q values and power response curves, normal modes',
          'Waves at interfaces, the wave equation',
          '2D/3D wave equations, wave energy and power',
          'Phase/group velocities, echo and beats',
          'Doppler effect, sound propagation in gases, solids, liquids',
          'Light – nature, propagation, reflection, refraction, scattering',
          'Thin lenses, wave nature, dispersion, Huygens’s principle, interference, diffraction',
          'Modern physics course outline',
        ],
        texts: ['Adewale’s Physics Volume 2'],
      },
      {
        code: 'CHM-CM 102',
        title: 'General Chemistry II',
        units: 2,
        lecturer: 'TBA',
        updated: 'Jul 23, 2026',
        description:
          'Introduction to organic chemistry — structure, nomenclature, reaction mechanisms and the chemistry of major functional groups — plus selected inorganic chemistry.',
        topics: [
          'Historical survey of the development and importance of organic chemistry',
          'Fullerenes as the fourth allotrope of carbon — nanotubes, nanostructures, nanochemistry',
          'Electronic theory in organic chemistry',
          'Isolation and purification of organic compounds; structure determination including qualitative and quantitative analysis; nomenclature and functional group classes',
          'Introductory reaction mechanism and kinetics',
          'Stereochemistry',
          'Chemistry of alkanes, alkenes, alkynes, alcohols, ethers, amines, alkyl halides, nitriles, aldehydes, ketones, carboxylic acids and derivatives',
          'Chemistry of selected metals and non-metals',
          'Comparative chemistry of group IA, IIA and IVA elements',
          'Introduction to transition metal chemistry',
        ],
        texts: [
          'Organic Chemistry Note by Momah Eche',
          'Raymond Chang Chemistry Textbook',
          'CHM 102 by Dr. O.A Atolani',
          'James McMurry Chemistry Textbook',
        ],
      },
      {
        code: 'MTH 102',
        title: 'Elementary Mathematics II',
        units: 2,
        lecturer: 'TBA',
        updated: 'Jul 23, 2026',
        description:
          'Differential and integral calculus of a single real variable, from first principles through to techniques of integration and their applications.',
        topics: [
          'Functions of a real variable, graphs',
          'Limits and the idea of continuity; right-hand and left-hand limits',
          'Differentiation from first principles',
          'Differentiation: algebraic, trig, log, exponential and arc trig functions',
          'Chain rule, product & quotient rule',
          'Implicit differentiation',
          'Maximum and minimum, curve sketching',
          'Word problems: rate of change in physical quantities',
          'Tangents to a normal curve',
          'Integration of functions',
          'Techniques of integration – substitution, by parts, partial fractions, rational fractions',
          'Reduction formulae, definite integrals',
          'Approximate integration',
          'Application of integration: areas, volume and moment of inertia',
        ],
        texts: [
          'Calculus Textbook by Paul Dawkins',
          'Just The Maths',
          'MTH 102 Textbook by Edwood Cares',
          'Engineering Maths (K.A Stroud)',
        ],
      },
      {
        code: 'LAG-MTH 103',
        title: 'Elementary Mathematics III',
        units: 2,
        lecturer: 'TBA',
        updated: 'Jul 23, 2026',
        description:
          'Vectors and coordinate geometry leading into particle kinematics and dynamics — the mathematical foundation for engineering mechanics.',
        topics: [
          'Geometric representation of vectors in 1–3 dimensions, components, direction cosines',
          'Addition and scalar multiplication of vectors, linear independence; scalar and vector products',
          'Differentiation and integration of vectors with respect to a scalar variable',
          'Two-dimensional coordinate geometry: straight lines, circles, parabola, ellipse, hyperbola, tangents, normals',
          'Kinematics of a particle; components of velocity and acceleration in a plane',
          'Force, momentum, laws of motion under gravity, projectiles and resisted vertical motion',
          'Elastic strings and simple pendulum; impulse and impact of smooth spheres',
        ],
        texts: ['Just The Maths', 'Engineering Maths (K.A Stroud)'],
      },
      {
        code: 'GET 102',
        title: 'Engineering Solid Modelling & Graphics I',
        units: 2,
        lecturer: 'TBA',
        updated: 'Jul 23, 2026',
        description:
          'Design thinking and technical graphics — orthographic and isometric projection, freehand sketching and solid modelling using professional CAD tools (Fusion 360, SolidWorks, Solid Edge or equivalent).',
        topics: [
          'Introduction to design thinking and engineering graphics',
          'First and third angle orthogonal projections',
          'Isometric projections; sectioning, conventional practices, conic sections and development',
          'Freehand and guided sketching — pictorial and orthographic',
          'Visualisation and solid modelling in design, prototyping and product-making',
          'Design, drawing, animation, rendering and simulation workspaces',
          'Sketching of 3D objects',
          'Viewports and sectioning of shop drawings; orthographic and perspective projections',
          'Sheet metal and surface modelling',
          'Material selection and rendering',
        ],
        texts: ['Pick Up & Parker'],
      },
      {
        code: 'STA 112',
        title: 'Probability I',
        units: 3,
        lecturer: 'TBA',
        updated: 'Jul 23, 2026',
        description:
          'Foundations of probability and descriptive statistics — counting principles, random variables, common distributions and exploratory data analysis.',
        topics: [
          'Permutations, combinations, basic probability principles',
          'Probability concepts, random variables (discrete and continuous), sample spaces',
          'Probability functions and distributions: binomial, geometric, Poisson, normal',
          'Combination of random variables and related distributions',
          'Sampling distributions of central tendency: mean, median, mode',
          'Exploratory data analysis via frequency distribution and graphical techniques',
          'Numerical summarization: arithmetic, geometric, harmonic means; median, mode; variance and standard deviation',
          'Random variables, Bayes’ theorem',
        ],
        texts: ['First Course in Statistics', 'Schaum’s Beginning Statistics', 'Schaum’s Discrete Mathematics'],
      },
      {
        code: 'GST 112',
        title: 'Nigerian People & Culture',
        units: 2,
        lecturer: 'TBA',
        updated: 'Jul 23, 2026',
        description:
          'Nigerian history, culture and society from pre-1800 through independence to present-day socio-political and civic developments.',
        topics: [
          'Nigerian history, culture and art up to 1800 (Yoruba, Hausa, Igbo and minority ethnic groups)',
          'Nigeria under colonial rule',
          'Evolution of Nigeria as a political unit (1914 amalgamation, political parties, nationalist movement)',
          'Nigeria and challenges of nation building (military intervention, Nigerian Civil War)',
          'Concepts of trade and economics of self-reliance',
          'Social justice and national development; judiciary and fundamental rights',
          'Individuals, norms and values; citizenship and civic responsibilities',
          'Re-orientation, moral and national values (OFN, Green Revolution, WAIC, MAMSER, NOA)',
          'Current socio-political and cultural developments in Nigeria',
        ],
        texts: [],
      },
    ],
  },
  200: {
    1: [
      {
        code: 'MME 201',
        title: 'Materials Science I',
        units: 3,
        lecturer: 'TBA',
        updated: 'Jul 05, 2026',
        description: 'Atomic structure, bonding and crystal structures as the foundation for understanding material properties.',
        topics: ['Atomic bonding and structure', 'Crystal systems and defects', 'Phase diagrams — introduction', 'Structure-property relationships'],
      },
      {
        code: 'MME 203',
        title: 'Mechanics of Materials',
        units: 3,
        lecturer: 'TBA',
        updated: 'Jul 03, 2026',
        description: 'Stress, strain and deformation behaviour of engineering materials under load.',
        topics: ['Stress and strain analysis', 'Torsion and bending', 'Elastic and plastic deformation', 'Failure theories'],
      },
    ],
    2: [
      {
        code: 'MME 202',
        title: 'Materials Science II',
        units: 3,
        lecturer: 'TBA',
        updated: 'Jun 20, 2026',
        description: 'Builds on MME 201 with a closer look at phase transformations and mechanical behaviour.',
        topics: ['Phase transformations', 'Mechanical testing methods', 'Polymers and ceramics overview', 'Composite materials basics'],
      },
      {
        code: 'MME 204',
        title: 'Thermodynamics of Materials',
        units: 2,
        lecturer: 'TBA',
        updated: 'Jun 18, 2026',
        description: 'Applies classical thermodynamics to phase equilibria and reactions relevant to metallurgy.',
        topics: ['Laws of thermodynamics recap', 'Free energy and phase equilibria', 'Solution thermodynamics', 'Ellingham diagrams'],
      },
    ],
  },
  300: {
    1: [
      {
        code: 'MME 301',
        title: 'Physical Metallurgy I',
        units: 3,
        lecturer: 'TBA',
        updated: 'Jul 18, 2026',
        description: 'Structure and properties of metals and alloys, with emphasis on the iron-carbon system.',
        topics: ['Solid solutions and intermetallics', 'The iron-carbon phase diagram', 'Heat treatment fundamentals', 'Microstructure examination'],
      },
      {
        code: 'MME 303',
        title: 'Phase Transformation',
        units: 2,
        lecturer: 'TBA',
        updated: 'Jul 14, 2026',
        description: 'Kinetics and mechanisms of phase changes in metallic systems.',
        topics: ['Nucleation and growth', 'TTT and CCT diagrams', 'Diffusional vs diffusionless transformations'],
      },
    ],
    2: [
      {
        code: 'MME 302',
        title: 'Physical Metallurgy II',
        units: 3,
        lecturer: 'TBA',
        updated: 'Jun 30, 2026',
        description: 'Advanced heat treatment and strengthening mechanisms for engineering alloys.',
        topics: ['Strengthening mechanisms', 'Advanced heat treatment cycles', 'Non-ferrous alloys'],
      },
      {
        code: 'MME 304',
        title: 'Ceramics and Glass Technology',
        units: 2,
        lecturer: 'TBA',
        updated: 'Jun 28, 2026',
        description: 'Processing, structure and applications of ceramic and glass materials.',
        topics: ['Ceramic processing routes', 'Glass formation and structure', 'Refractories', 'Applications in industry'],
      },
    ],
  },
  400: {
    1: [
      {
        code: 'MME 401',
        title: 'Extractive Metallurgy I',
        units: 3,
        lecturer: 'TBA',
        updated: 'Jul 02, 2026',
        description: 'Principles of extracting metals from their ores via pyro- and hydrometallurgical routes.',
        topics: ['Ore beneficiation', 'Pyrometallurgy fundamentals', 'Hydrometallurgy fundamentals', 'Case study: iron and steelmaking'],
      },
      {
        code: 'MME 403',
        title: 'Corrosion Engineering',
        units: 2,
        lecturer: 'TBA',
        updated: 'Jun 29, 2026',
        description: 'Electrochemical basis of corrosion and engineering approaches to its control.',
        topics: ['Electrochemistry of corrosion', 'Types of corrosion', 'Corrosion testing', 'Protection and inhibition methods'],
      },
    ],
    2: [
      {
        code: 'MME 402',
        title: 'Extractive Metallurgy II',
        units: 3,
        lecturer: 'TBA',
        updated: 'Jun 15, 2026',
        description: 'Continuation of MME 401 with a focus on refining and non-ferrous extraction.',
        topics: ['Electrometallurgy', 'Refining processes', 'Non-ferrous metal extraction', 'Environmental considerations'],
      },
      {
        code: 'MME 404',
        title: 'Welding Metallurgy',
        units: 2,
        lecturer: 'TBA',
        updated: 'Jun 10, 2026',
        description: 'Metallurgical changes that occur during welding and their effect on joint performance.',
        topics: ['Welding processes overview', 'Heat-affected zone metallurgy', 'Weldability of engineering alloys', 'Weld defects and inspection'],
      },
    ],
  },
  500: {
    1: [
      {
        code: 'MME 501',
        title: 'Final Year Project I',
        units: 6,
        lecturer: 'Project supervisor',
        updated: 'Jul 20, 2026',
        description: 'Proposal, literature review and methodology development for the final year research project.',
        topics: ['Topic selection and proposal', 'Literature review', 'Research methodology', 'Progress presentations'],
      },
      {
        code: 'MME 503',
        title: 'Materials Failure Analysis',
        units: 2,
        lecturer: 'TBA',
        updated: 'Jul 12, 2026',
        description: 'Systematic approach to diagnosing why engineering components fail in service.',
        topics: ['Failure analysis methodology', 'Fatigue and fracture', 'Case studies', 'Failure reporting'],
      },
    ],
    2: [
      {
        code: 'MME 502',
        title: 'Final Year Project II',
        units: 6,
        lecturer: 'Project supervisor',
        updated: 'Jun 25, 2026',
        description: 'Execution, results and defence of the final year research project begun in MME 501.',
        topics: ['Experimental work / implementation', 'Data analysis and discussion', 'Report writing', 'Oral defence'],
      },
      {
        code: 'MME 504',
        title: 'Industrial Metallurgy',
        units: 2,
        lecturer: 'TBA',
        updated: 'Jun 22, 2026',
        description: 'Metallurgical practice as applied in Nigerian industry, informed by site visits and case studies.',
        topics: ['Steel and cement industry practice', 'Quality control in production', 'Industrial site visit debrief', 'Industry guest lectures'],
      },
    ],
  },
}

export function getCourses(level, semester) {
  return outlines[level]?.[semester] || []
}

export function getCourse(level, semester, code) {
  return getCourses(level, semester).find((c) => c.code.replace(/\s+/g, '').toLowerCase() === code.toLowerCase())
}
