-- ============================================================================
-- SQEPify training catalogue
-- ============================================================================
-- Replaces the formula-generated catalogue (one course per competency per
-- level) with a real one: The Nuclear House's published courses, plus the
-- courses the competency framework needs and does not yet have.
--
-- Published courses are status 'active'. Courses that do not exist yet are
-- status 'required', so the catalogue itself is the build backlog.
--
-- This script touches ONLY trainings, training deliverers and the learning
-- path links. It does NOT touch competencies, subcategories, categories or
-- roles. The framework is edited through the SQEPify UI and is not reseeded.
--
-- Safe to re-run. Trainings gain a stable `code`, so a second run updates in
-- place rather than duplicating.
--
-- Run AFTER the "Trainings describe themselves properly" SQL in CHANGELOG.md,
-- which adds the columns this script fills.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. A stable code, so this catalogue can be updated rather than rebuilt.
-- ----------------------------------------------------------------------------
alter table public.trainings add column if not exists code text;
create unique index if not exists trainings_code_unique
  on public.trainings (code) where code is not null;


-- ----------------------------------------------------------------------------
-- 2. Clear the old formula-generated catalogue.
--    Only rows without a code, so re-running this script never deletes the
--    catalogue it just created, and anything you add by hand later survives
--    only if it has no code (add codes by hand if you want it protected).
-- ----------------------------------------------------------------------------
delete from public.trainings where code is null;


-- ----------------------------------------------------------------------------
-- 3. The catalogue.
-- ----------------------------------------------------------------------------
insert into public.trainings
  (code, title, family, status, delivery_mode, pacing, duration_hours,
   assessment_method, issues_certificate, validity_months, provider, description, outcomes)
values

-- ===== Engineering disciplines (published) =================================
('dfma-in-nuclear',
 'Design for Manufacture, Assembly and Operations in Nuclear',
 'Engineering disciplines', 'active', 'in_person', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'How design choices decide what can actually be manufactured, assembled, commissioned and operated on a licensed site, and what it costs to discover that late. Covers modularisation, tolerance and fit-up, factory versus site work, and designing for work in a controlled area.',
 array[
   'Identify the design features that drive manufacturing and assembly risk in a nuclear context',
   'Apply modularisation and standardisation to reduce work in radiological areas',
   'Challenge a design against build, commissioning and operability constraints',
   'Record manufacturing and assembly assumptions so they carry through to the safety case'
 ]),

('eci-in-nuclear',
 'EC&I in Nuclear (Electrical, Control and Instrumentation)',
 'Engineering disciplines', 'active', 'in_person', 'instructor_led', 24,
 'exam', true, 36, 'The Nuclear House',
 'Electrical, control and instrumentation engineering as it is practised on nuclear plant: the safety role of the systems, the standards that govern them, and how classification drives design rigour, qualification and testing.',
 array[
   'Describe the safety duty of electrical and C&I systems and how it is classified',
   'Apply the relevant standards to the design of a nuclear C&I system',
   'Explain separation, segregation, redundancy and diversity in an electrical distribution design',
   'Set qualification and testing expectations proportionate to the system classification'
 ]),

('systems-engineering-nuclear',
 'Systems Engineering in Nuclear',
 'Engineering disciplines', 'active', 'in_person', 'instructor_led', 21,
 'knowledge_check', true, null, 'The Nuclear House',
 'Systems engineering applied to nuclear projects: requirements through architecture, interfaces, verification and validation, and how the systems approach keeps the safety case and the design in step across a long programme.',
 array[
   'Decompose a plant need into system, subsystem and component requirements',
   'Define and control an interface so it survives design change',
   'Plan verification and validation proportionate to safety classification',
   'Explain how the systems approach supports the safety case golden thread'
 ]),

('mechanical-engineering-nuclear',
 'Mechanical Engineering in Nuclear',
 'Engineering disciplines', 'active', 'in_person', 'instructor_led', 21,
 'knowledge_check', true, null, 'The Nuclear House',
 'Mechanical engineering in a nuclear setting: codes and standards for nuclear plant, pressure boundary design, material selection for a radiation and chemistry environment, and the qualification evidence a safety case expects.',
 array[
   'Select the appropriate design code for a nuclear mechanical component',
   'Explain how classification drives design margin, inspection and qualification',
   'Identify the degradation mechanisms relevant to a given duty and environment',
   'Assemble the evidence a mechanical claim in a safety case has to rest on'
 ]),

('civil-structural-nuclear',
 'Civil & Structural Engineering in Nuclear',
 'Engineering disciplines', 'active', 'in_person', 'instructor_led', 21,
 'knowledge_check', true, null, 'The Nuclear House',
 'Civil and structural engineering for nuclear facilities: seismic and external hazard loading, structural classification, containment and shielding structures, and the long design life that nuclear civils have to deliver.',
 array[
   'Explain how external hazards translate into structural design loads',
   'Apply structural classification to a nuclear building or structure',
   'Describe the interaction between structural design, shielding and containment',
   'Identify the durability and ageing issues that a 60 year design life raises'
 ]),

('hvac-in-nuclear',
 'HVAC in Nuclear (ventilation and contamination control)',
 'Engineering disciplines', 'active', 'in_person', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'Nuclear ventilation as a safety system rather than a comfort system: cascade and containment by pressure zoning, filtration and its qualification, and the role ventilation plays in limiting worker dose and controlling release.',
 array[
   'Explain pressure cascade and zoning as a contamination control measure',
   'Specify filtration and its testing to suit the source term',
   'Describe how ventilation contributes to the containment claim in a safety case',
   'Identify the failure modes of a nuclear ventilation system and their consequences'
 ]),

('materials-welding-nuclear',
 'Materials & Welding in Nuclear',
 'Engineering disciplines', 'active', 'in_person', 'instructor_led', 21,
 'exam', true, null, 'The Nuclear House',
 'Material behaviour and welding practice for nuclear plant: irradiation and environmental degradation, weld procedure and qualification, and the inspection regime that underpins a structural integrity claim.',
 array[
   'Identify the degradation mechanisms that act on nuclear plant materials',
   'Explain weld procedure qualification and why nuclear demands more of it',
   'Select non-destructive examination appropriate to the defect of concern',
   'Describe how material and weld evidence supports a structural integrity case'
 ]),

-- ===== Safety & regulatory (published) =====================================
('iosh-managing-safely-nuclear',
 'IOSH Managing Safely in Nuclear',
 'Safety & regulatory', 'active', 'in_person', 'instructor_led', 24,
 'exam', true, 36, 'IOSH',
 'The IOSH Managing Safely syllabus taught throughout with nuclear examples: risk assessment, legal duties, investigation and measurement, set in the context of a licensed site and its licence conditions.',
 array[
   'Apply the legal duties on managers to work on a licensed nuclear site',
   'Carry out a risk assessment and justify the controls chosen',
   'Investigate an incident and identify the organisational causes',
   'Measure and report safety performance meaningfully'
 ]),

('iosh-nuclear-upskill-1day',
 'Nuclear One Day Upskilling for IOSH Managing Safely Holders',
 'Safety & regulatory', 'active', 'in_person', 'instructor_led', 8,
 'knowledge_check', true, 36, 'The Nuclear House',
 'A single day that converts a general Managing Safely qualification into a nuclear one, for people who already hold the certificate. Covers what a licensed site adds: licence conditions, radiological risk, and the regulator''s expectations.',
 array[
   'Describe what nuclear site licensing adds to conventional health and safety duties',
   'Recognise radiological risk and the controls that manage it',
   'Explain the regulator''s role and expectations of a manager',
   'Apply conventional risk assessment to a radiological work activity'
 ]),

('alarp-in-practice',
 'ALARP Demonstration in Practice',
 'Safety & regulatory', 'active', 'in_person', 'instructor_led', 16,
 'portfolio', true, null, 'The Nuclear House',
 'How to build an ALARP argument that survives scrutiny: relevant good practice, option identification, cost benefit analysis and gross disproportion, and how to write the demonstration so a regulator can follow it.',
 array[
   'Explain the legal basis of ALARP and where the burden of proof sits',
   'Identify and screen options for reducing risk on a real design problem',
   'Apply cost benefit analysis with gross disproportion correctly',
   'Write an ALARP demonstration that a third party can follow and challenge'
 ]),

('defence-in-depth-for-design',
 'Defence in Depth: What It Means for Your Design',
 'Safety & regulatory', 'active', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, null, 'The Nuclear House',
 'Defence in depth translated from principle into design decisions: the levels, independence between them, and how a designer demonstrates that a proposed change has not quietly eroded a level.',
 array[
   'Describe the levels of defence in depth and the purpose of each',
   'Test a design for independence between successive levels',
   'Recognise common mode failure that defeats defence in depth',
   'Judge whether a design change weakens a level of defence'
 ]),

('cdm-2015-nuclear-designers',
 'CDM 2015 for Nuclear Designers',
 'Safety & regulatory', 'active', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, 36, 'The Nuclear House',
 'Construction (Design and Management) Regulations 2015 duties as they fall on a designer working in nuclear, including how CDM sits alongside licence conditions and radiological protection rather than replacing them.',
 array[
   'State the designer duties CDM 2015 places on you personally',
   'Apply the general principles of prevention to a nuclear design decision',
   'Record and communicate residual risk in design information',
   'Explain how CDM duties interact with licence conditions on site'
 ]),

('human-factors-nuclear-design',
 'Human Factors in Nuclear Design',
 'Safety & regulatory', 'active', 'in_person', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'Designing for the people who will operate and maintain the plant: task analysis, human machine interface, workload and error, and how human factors evidence enters the safety case.',
 array[
   'Carry out a task analysis for a safety significant operator action',
   'Identify design features that make human error more or less likely',
   'Specify human machine interface requirements proportionate to the risk',
   'Describe how human factors evidence supports a claim in the safety case'
 ]),

('fault-studies-consequence-analysis',
 'Fault Studies & Consequence Analysis',
 'Safety & regulatory', 'active', 'in_person', 'instructor_led', 24,
 'exam', true, null, 'The Nuclear House',
 'Identifying what can go wrong and working out how bad it gets: fault identification, the fault schedule, initiating frequency, and consequence analysis against dose and release criteria.',
 array[
   'Identify initiating faults systematically for a plant or process',
   'Build and maintain a fault schedule',
   'Estimate consequence against the relevant dose and release criteria',
   'Derive safety measures from the fault schedule and justify their classification'
 ]),

('safety-case-fundamentals-engineers',
 'Safety Case Fundamentals for Engineers in Nuclear',
 'Safety & regulatory', 'active', 'in_person', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'What a nuclear safety case is, what it is for, and what an engineer contributes to it: claims, arguments and evidence, the structure of a case, and how engineering work becomes evidence someone else can rely on.',
 array[
   'Explain the purpose and legal standing of a nuclear safety case',
   'Distinguish claims, arguments and evidence and write each properly',
   'Locate your own engineering work in the structure of a case',
   'Produce engineering output in a form the safety case can use as evidence'
 ]),

-- ===== Lifecycle & delivery (published) ====================================
('design-for-decommissioning',
 'Design for Decommissioning',
 'Lifecycle & delivery', 'active', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, null, 'The Nuclear House',
 'Designing a facility for the end of its life as well as the start: material and layout choices that reduce eventual waste and dose, and the decommissioning assumptions that need recording while they are still cheap to change.',
 array[
   'Identify design choices that drive decommissioning cost, dose and waste',
   'Apply material selection and layout decisions that ease later dismantling',
   'Record decommissioning assumptions so they survive to the end of life',
   'Explain the waste hierarchy and its influence on design'
 ]),

('nuclear-configuration-management',
 'Nuclear Configuration Management',
 'Lifecycle & delivery', 'active', 'virtual', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'Keeping the design, the plant and the documentation saying the same thing for decades: configuration baselines, change control, and what configuration drift does to a safety case.',
 array[
   'Define a configuration baseline and what belongs inside it',
   'Operate a change control process proportionate to safety significance',
   'Recognise configuration drift and its consequences for the safety case',
   'Specify the records that keep design, plant and documents aligned'
 ]),

('requirements-management-nuclear',
 'Requirements Management in Nuclear',
 'Lifecycle & delivery', 'active', 'virtual', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'Writing, tracing and controlling requirements on a nuclear project: deriving safety functional requirements from the safety case, keeping traceability intact through change, and closing requirements out with evidence.',
 array[
   'Write a requirement that is unambiguous, testable and traceable',
   'Derive safety functional requirements from safety case claims',
   'Maintain traceability from claim through requirement to verification evidence',
   'Manage requirement change without breaking the golden thread'
 ]),

('supply-chain-quality-nuclear',
 'Supply Chain Quality in Nuclear',
 'Lifecycle & delivery', 'active', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, null, 'The Nuclear House',
 'Getting nuclear quality out of a supply chain: grading requirements to safety significance, intelligent customer capability, surveillance and inspection, and the counterfeit and suspect items problem.',
 array[
   'Grade quality requirements to the safety significance of the item',
   'Act as an intelligent customer for a procured item or service',
   'Plan surveillance and inspection at the right points in manufacture',
   'Recognise counterfeit, fraudulent and suspect items and the controls against them'
 ]),

('nuclear-project-lifecycle-gda-ops',
 'Nuclear Project Lifecycle: From GDA to Operations',
 'Lifecycle & delivery', 'active', 'in_person', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'The whole route from generic design assessment through site licensing, construction and commissioning into operations, and what each stage demands of the design and the safety case.',
 array[
   'Describe the stages of a UK nuclear project and the regulatory gate at each',
   'Explain what generic design assessment does and does not settle',
   'Identify what site licensing adds to a generic design',
   'Anticipate the evidence each stage will demand of your own discipline'
 ]),

-- ===== Operational awareness for designers (published) =====================
('radiation-protection-fundamentals-engineers',
 'Radiation Protection Fundamentals for Engineers',
 'Operational awareness for designers', 'active', 'blended', 'instructor_led', 8,
 'knowledge_check', true, 24, 'The Nuclear House',
 'Radiological protection for people who design rather than operate: sources and pathways, dose limits and constraints, the hierarchy of control, and how design decisions determine the dose someone else will take.',
 array[
   'Explain the quantities and units used in radiological protection',
   'Apply the hierarchy of control to reduce dose by design',
   'Estimate the dose consequence of a maintenance or inspection task',
   'State the statutory dose limits and constraints that apply'
 ]),

('nuclear-operations-for-designers',
 'Nuclear Operations: What Designers Need to Know',
 'Operational awareness for designers', 'active', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, null, 'The Nuclear House',
 'How a nuclear plant is actually run, for people who will never run one: operating rules and limits, permits and isolations, shift handover, and the operational realities that a design either helps or fights.',
 array[
   'Describe how operating rules and safety limits constrain plant operation',
   'Explain the permit to work and isolation regime and its design implications',
   'Recognise design features that make operation harder or more error prone',
   'Anticipate the operational questions a design review will ask'
 ]),

('maintenance-inspection-access-design',
 'Maintenance & Inspection Access in Design',
 'Operational awareness for designers', 'active', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, null, 'The Nuclear House',
 'Designing so the plant can be maintained and inspected without excessive dose, time or scaffolding. Covers access routes, handling, in-service inspection requirements, and dose reduction by layout.',
 array[
   'Plan access and handling for maintenance in a radiological area',
   'Specify a design that meets its in-service inspection requirements',
   'Reduce collective dose through layout and shielding decisions',
   'Justify maintenance access choices as part of an ALARP argument'
 ]),

('outage-planning-awareness',
 'Outage Planning Awareness',
 'Operational awareness for designers', 'active', 'virtual', 'instructor_led', 4,
 'none', true, null, 'The Nuclear House',
 'What an outage is, why it dominates a plant''s cost and risk profile, and how work is scoped, sequenced and resourced inside a fixed window that everything else waits for.',
 array[
   'Describe how an outage is scoped, sequenced and frozen',
   'Explain the effect of outage duration on generation and cost',
   'Recognise the design features that shorten or lengthen an outage',
   'Identify where your own work lands in an outage schedule'
 ]),

('pwr-reactor-operations',
 'PWR Reactor Operations',
 'Operational awareness for designers', 'active', 'in_person', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'How a pressurised water reactor behaves and is operated: the primary and secondary circuits, reactivity control, normal operating states and transients, and what the operator is watching and why.',
 array[
   'Describe the main systems of a PWR and what each is for',
   'Explain reactivity control and the feedback mechanisms in play',
   'Walk through startup, power operation, shutdown and refuelling states',
   'Recognise the principal transients and the plant response to each'
 ]),

-- ===== Soft skills (published) =============================================
('nuclear-safety-culture',
 'Nuclear Safety Culture',
 'Soft skills', 'active', 'blended', 'instructor_led', 8,
 'knowledge_check', true, 24, 'The Nuclear House',
 'What a healthy nuclear safety culture looks like in daily behaviour rather than on a poster: the recognised traits, what erodes them, and the personal habits that hold them up under schedule pressure.',
 array[
   'Describe the recognised traits of a healthy nuclear safety culture',
   'Recognise the early warning signs of cultural erosion',
   'Apply a questioning attitude to your own work and to others''',
   'Raise a safety concern effectively and know what to expect afterwards'
 ]),

('communicating-with-regulators',
 'Communicating with Regulators',
 'Soft skills', 'active', 'in_person', 'instructor_led', 8,
 'practical_observation', true, null, 'The Nuclear House',
 'How to deal with a regulator well: what an inspector is actually testing, how to answer a question precisely without over-claiming, and how to present technical work to someone who will probe it.',
 array[
   'Explain what a regulatory inspector is testing in an interaction',
   'Answer a technical question precisely, without speculation or over-claim',
   'Present engineering work so its limitations are visible and defensible',
   'Handle a challenge to your judgement without conceding or digging in'
 ]),

('engineering-decision-making',
 'Engineering Decision-Making in High-Consequence Environments',
 'Soft skills', 'active', 'in_person', 'instructor_led', 16,
 'practical_observation', true, null, 'The Nuclear House',
 'Making and defending engineering decisions where being wrong is expensive: conservative decision making, handling uncertainty, recognising bias and schedule pressure, and knowing when to stop and escalate.',
 array[
   'Apply conservative decision making when the evidence is incomplete',
   'Recognise the biases and pressures that distort engineering judgement',
   'Decide when to stop, escalate or ask for independent challenge',
   'Record a decision and its basis so it can be reviewed years later'
 ]),

('learning-from-events-opex',
 'Learning from Events (OPEX)',
 'Soft skills', 'active', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, null, 'The Nuclear House',
 'Using operating experience properly: where industry OPEX comes from, how to screen it for relevance, root cause techniques, and why most organisations record lessons without ever learning them.',
 array[
   'Screen industry operating experience for relevance to your own work',
   'Apply a root cause technique to an event and reach organisational causes',
   'Write a corrective action that actually changes behaviour',
   'Explain why lessons identified so often fail to become lessons learned'
 ]),

('conflict-management',
 'Conflict Management',
 'Soft skills', 'active', 'in_person', 'instructor_led', 8,
 'practical_observation', true, null, 'The Nuclear House',
 'Handling technical disagreement without damage: separating the position from the person, disagreeing on safety grounds in front of commercial pressure, and keeping an environment where people still speak up afterwards.',
 array[
   'Separate a technical disagreement from a personal one',
   'Hold a safety position under commercial or schedule pressure',
   'Use escalation routes without turning a disagreement into a dispute',
   'Keep a working relationship intact after a disagreement is settled'
 ]),

('critical-thinking-prioritisation',
 'Critical Thinking & Prioritisation',
 'Soft skills', 'active', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, null, 'The Nuclear House',
 'Thinking clearly under load: testing an argument for its weak link, distinguishing what is known from what is assumed, and deciding what genuinely matters when everything is marked urgent.',
 array[
   'Test an argument and locate the assumption it actually rests on',
   'Distinguish evidence, inference and assumption in a technical claim',
   'Prioritise work by consequence rather than by who is asking loudest',
   'Frame a problem accurately before starting to solve it'
 ]),

-- ===== Safety analysis & assessment (proposed additions) ===================
('sap-application-in-practice',
 'ONR Safety Assessment Principles in Practice',
 'Safety analysis & assessment', 'required', 'in_person', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'The Safety Assessment Principles and the supporting technical assessment guides as an assessor actually uses them: how a principle becomes a numerical target, and how to demonstrate compliance or justify a shortfall.',
 array[
   'Navigate the SAPs and the technical assessment guides for your discipline',
   'Apply the numerical targets to a real assessment',
   'Demonstrate compliance with a principle in written form',
   'Justify a departure from a principle where compliance is not reasonably practicable'
 ]),

('categorisation-classification',
 'Safety Categorisation & Classification',
 'Safety analysis & assessment', 'required', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, null, 'The Nuclear House',
 'Categorising safety functions and classifying the structures, systems and components that deliver them, and the engineering consequences that follow from where a class boundary lands.',
 array[
   'Categorise a safety function against its consequence and role',
   'Classify the structures, systems and components delivering that function',
   'Explain what a classification demands in design, qualification and inspection',
   'Defend a classification decision at a design review'
 ]),

('internal-external-hazards-analysis',
 'Internal & External Hazards Analysis',
 'Safety analysis & assessment', 'required', 'in_person', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'Hazards that are not process faults: fire, flood, dropped loads, seismic, extreme weather and malicious acts. Screening, frequency, combination and how hazard protection is claimed in the safety case.',
 array[
   'Screen internal and external hazards for a site and facility',
   'Derive the design basis event for a screened-in hazard',
   'Assess hazard combinations and consequential effects',
   'Claim hazard protection correctly in a safety case'
 ]),

('psa-fundamentals',
 'Probabilistic Safety Assessment: Fundamentals',
 'Safety analysis & assessment', 'required', 'virtual', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'What PSA is for, how a model is built from event and fault trees, what the numbers mean and, more importantly, what they do not mean.',
 array[
   'Explain the purpose and the levels of a probabilistic safety assessment',
   'Read an event tree and a fault tree and follow the logic',
   'Interpret a PSA result and its uncertainty honestly',
   'Recognise where a PSA is being asked to carry more than it can'
 ]),

('psa-practitioner',
 'Probabilistic Safety Assessment: Practitioner',
 'Safety analysis & assessment', 'required', 'in_person', 'instructor_led', 24,
 'portfolio', true, null, 'The Nuclear House',
 'Building and maintaining a PSA model: data and reliability sources, common cause failure, human error probability, sensitivity and importance measures, and using the model to inform design.',
 array[
   'Build a fault tree and event tree model for a defined scope',
   'Select and justify reliability data and common cause parameters',
   'Run sensitivity and importance analysis and act on the result',
   'Use PSA insight to inform a design or operational decision'
 ]),

('criticality-safety-assessment',
 'Criticality Safety Assessment',
 'Safety analysis & assessment', 'required', 'in_person', 'instructor_led', 24,
 'exam', true, null, 'The Nuclear House',
 'Preventing inadvertent criticality: the controlling parameters, the double contingency principle, criticality safety assessment methods, and the operational controls that follow from an assessment.',
 array[
   'Identify the parameters that control criticality in a given operation',
   'Apply the double contingency principle to a process design',
   'Carry out and document a criticality safety assessment',
   'Translate assessment conclusions into workable operational controls'
 ]),

('human-reliability-analysis',
 'Human Reliability Analysis',
 'Safety analysis & assessment', 'required', 'virtual', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'Quantifying human failure for use in safety analysis: task decomposition, error identification, the main HRA methods, performance shaping factors and dependency.',
 array[
   'Decompose a safety significant task and identify the credible errors',
   'Apply an established HRA method to derive a human error probability',
   'Justify performance shaping factors and dependency assumptions',
   'Feed an HRA result into a PSA or a deterministic claim defensibly'
 ]),

('shielding-source-term-design',
 'Shielding Design & Source Term Definition',
 'Safety analysis & assessment', 'required', 'in_person', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'Defining a source term and designing the shielding that answers it: methods and codes, streaming and penetrations, and the balance between shielding, layout and operational dose.',
 array[
   'Define a source term for a facility, process or package',
   'Select and apply an appropriate shielding calculation method',
   'Design out streaming paths and penetration weaknesses',
   'Balance shielding against layout and operational dose in an ALARP argument'
 ]),

('dose-assessment-modelling',
 'Dose Assessment & Modelling',
 'Safety analysis & assessment', 'required', 'virtual', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'Assessing dose to workers and to the public: pathways, dispersion and dose conversion, normal operation against fault conditions, and the criteria the result is judged against.',
 array[
   'Model the dose pathways relevant to a release or exposure',
   'Assess worker and public dose for normal and fault conditions',
   'Apply the relevant dose criteria and constraints to the result',
   'Present a dose assessment with its assumptions and uncertainty visible'
 ]),

('safety-case-golden-thread-practitioner',
 'Safety Case Structure & the Golden Thread: Practitioner',
 'Safety analysis & assessment', 'required', 'in_person', 'instructor_led', 24,
 'portfolio', true, null, 'The Nuclear House',
 'Producing and maintaining a safety case rather than contributing to one: structuring the argument, keeping the thread from claim to evidence intact, and managing the case through modification and periodic review.',
 array[
   'Structure a safety case argument from top claim down to evidence',
   'Maintain the golden thread through design change and modification',
   'Plan and deliver a periodic safety review',
   'Review someone else''s safety case and identify where the thread breaks'
 ]),

('design-basis-analysis-practitioner',
 'Design Basis Analysis: Practitioner',
 'Safety analysis & assessment', 'required', 'in_person', 'instructor_led', 24,
 'portfolio', true, null, 'The Nuclear House',
 'Carrying out design basis analysis to a standard a regulator will accept: conservative assumptions, single failure, rule sets and acceptance criteria, and demonstrating adequacy of the safety measures.',
 array[
   'Set up a design basis analysis with defensible conservative assumptions',
   'Apply single failure criteria and the relevant rule set',
   'Demonstrate that the claimed safety measures are adequate',
   'Document the analysis so it can be independently checked'
 ]),

-- ===== Engineering disciplines (proposed additions) ========================
('reactor-theory-neutronics',
 'Reactor Theory & Neutronics',
 'Engineering disciplines', 'required', 'in_person', 'instructor_led', 24,
 'exam', true, null, 'The Nuclear House',
 'The physics a reactor engineer works from: neutron transport and diffusion, criticality and reactivity, feedback and poisons, and the calculation methods used in practice.',
 array[
   'Explain neutron behaviour, moderation and the fission chain reaction',
   'Calculate reactivity effects and interpret feedback coefficients',
   'Describe fission product poisoning and its operational consequences',
   'Select an appropriate neutronics method for a given problem'
 ]),

('core-design-fuel-management',
 'Core Design & Fuel Management',
 'Engineering disciplines', 'required', 'in_person', 'instructor_led', 24,
 'knowledge_check', true, null, 'The Nuclear House',
 'Designing and managing a reactor core over its life: loading patterns, burnup and cycle length, power peaking and margins, and the fuel performance limits that constrain the whole design.',
 array[
   'Explain the drivers behind a core loading pattern',
   'Assess power peaking and thermal margin for a proposed core',
   'Describe fuel performance limits and the mechanisms behind them',
   'Plan a fuel cycle against operational and safety constraints'
 ]),

('thermal-hydraulic-analysis',
 'Thermal-Hydraulic Analysis',
 'Engineering disciplines', 'required', 'in_person', 'instructor_led', 24,
 'exam', true, null, 'The Nuclear House',
 'Heat removal and fluid behaviour in nuclear plant: single and two phase flow, critical heat flux, natural circulation, and the system codes used for transient and accident analysis.',
 array[
   'Analyse single and two phase flow in a nuclear heat removal system',
   'Assess critical heat flux and the margin to it',
   'Explain natural circulation and its role in passive safety',
   'Set up and interpret a system code transient analysis'
 ]),

('coolant-plant-chemistry',
 'Coolant & Plant Chemistry',
 'Engineering disciplines', 'required', 'virtual', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'Why chemistry control decides plant life: coolant chemistry regimes, corrosion and crud, activity transport and dose rates, and the consequences of losing chemistry control.',
 array[
   'Describe the coolant chemistry regime and the reasons behind each control',
   'Link chemistry excursions to corrosion and material degradation',
   'Explain activity transport and its effect on radiation fields and dose',
   'Specify chemistry monitoring and the response to an out of specification result'
 ]),

('structural-integrity-assessment',
 'Structural Integrity Assessment',
 'Engineering disciplines', 'required', 'in_person', 'instructor_led', 24,
 'portfolio', true, null, 'The Nuclear House',
 'Demonstrating that a pressure boundary or structure will not fail: defect tolerance, fracture assessment, fatigue and creep, and the inspection and monitoring that support the claim.',
 array[
   'Carry out a defect tolerance assessment to a recognised procedure',
   'Assess fatigue and creep damage for a nuclear component',
   'Specify inspection to support a structural integrity claim',
   'Present a structural integrity case, including the high integrity argument where claimed'
 ]),

('pressure-systems-containment',
 'Pressure Systems & Containment',
 'Engineering disciplines', 'required', 'virtual', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'Pressure boundary and containment as safety systems: design codes, statutory pressure systems duties, leak tightness and testing, and the containment claim in the safety case.',
 array[
   'Apply the relevant design code to a nuclear pressure system',
   'State the statutory duties for pressure systems and written schemes of examination',
   'Specify leak tightness requirements and the testing that proves them',
   'Explain how containment performance is claimed and demonstrated'
 ]),

('computer-based-safety-systems',
 'Computer-Based Systems & Software Reliability',
 'Engineering disciplines', 'required', 'in_person', 'instructor_led', 24,
 'exam', true, null, 'The Nuclear House',
 'Claiming reliability from software: the standards for computer-based safety systems, production excellence and independent confidence building, diversity, and why software reliability cannot simply be measured.',
 array[
   'Apply the relevant standards to a computer-based safety system',
   'Explain production excellence and independent confidence building measures',
   'Justify a reliability claim for software in a safety system',
   'Assess diversity and defence against common cause software failure'
 ]),

-- ===== Safety & regulatory (proposed additions) ============================
('nuclear-security-safeguards',
 'Nuclear Security & Safeguards',
 'Safety & regulatory', 'required', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, 36, 'The Nuclear House',
 'The security and safeguards regime alongside safety: the regulatory framework, security by design, the interface between safety and security, and material accountancy and international safeguards obligations.',
 array[
   'Describe the UK nuclear security regulatory framework and who enforces it',
   'Apply security by design and recognise where it conflicts with safety',
   'Explain nuclear material accountancy and control',
   'State the safeguards obligations that apply and what they require of a design'
 ]),

('radiation-environmental-regulations',
 'Radiation & Environmental Regulations',
 'Safety & regulatory', 'required', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, 36, 'The Nuclear House',
 'The statutory framework around radiation and the environment: the Ionising Radiations Regulations, environmental permitting and radioactive substances regulation, and what each demands of a design and an operator.',
 array[
   'State the duties the Ionising Radiations Regulations place on employers and designers',
   'Explain environmental permitting for radioactive substances',
   'Identify the discharge and disposal limits that constrain a facility',
   'Recognise where a design decision creates a permitting consequence'
 ]),

('licensing-licence-conditions',
 'Nuclear Site Licensing & Licence Conditions',
 'Safety & regulatory', 'required', 'in_person', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'The nuclear site licence and the conditions attached to it: what each condition requires in practice, the licensee''s arrangements beneath them, and how modification and consent actually work.',
 array[
   'Explain the legal basis of the nuclear site licence and its conditions',
   'Locate the licence conditions that bear on your own work',
   'Describe the licensee arrangements that implement a licence condition',
   'Follow the modification and consent process for a proposed change'
 ]),

('iaea-industry-standards',
 'IAEA Standards & Industry Codes',
 'Safety & regulatory', 'required', 'elearning', 'self_paced', 4,
 'knowledge_check', true, null, 'The Nuclear House',
 'The international standards landscape: the IAEA safety standards hierarchy, WENRA reference levels, and the main industry codes, and how they relate to UK regulation and to relevant good practice.',
 array[
   'Navigate the IAEA safety standards hierarchy and find the right document',
   'Explain how international standards relate to UK regulatory expectations',
   'Identify the industry codes that apply to your discipline',
   'Use standards as evidence of relevant good practice in an ALARP argument'
 ]),

('emergency-preparedness-response',
 'Emergency Preparedness & Response',
 'Safety & regulatory', 'required', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, 24, 'The Nuclear House',
 'The emergency arrangements a licensed site must hold, the regulations behind them, and what design and analysis have to provide so that those arrangements are workable.',
 array[
   'Describe the statutory emergency preparedness framework for a licensed site',
   'Explain the reference accident and its role in setting emergency planning',
   'Identify what emergency response demands of a plant design',
   'State your own role and duties in a site emergency'
 ]),

-- ===== Lifecycle & delivery (proposed additions) ===========================
('radioactive-waste-routes',
 'Radioactive Waste Characterisation & Disposal Routes',
 'Lifecycle & delivery', 'required', 'virtual', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'Knowing what the waste is and where it can go: categorisation, characterisation methods, conditioning and packaging, and the disposability assessment that decides whether a route exists at all.',
 array[
   'Categorise a waste stream and characterise it defensibly',
   'Select a conditioning and packaging route for a given waste',
   'Explain disposability assessment and the letter of compliance process',
   'Apply the waste hierarchy to a design or operational decision'
 ]),

('decommissioning-strategy-delivery',
 'Decommissioning Strategy & Delivery',
 'Lifecycle & delivery', 'required', 'in_person', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'Taking a facility from end of generation to site end state: strategy options and their trade-offs, characterisation, dismantling techniques, and the safety case for a plant whose hazard is changing as you work.',
 array[
   'Compare decommissioning strategies and justify a selection',
   'Plan characterisation ahead of a dismantling campaign',
   'Select dismantling and decontamination techniques for a given hazard',
   'Explain how a decommissioning safety case differs from an operational one'
 ]),

('sat-competence-management',
 'Competence Management & the Systematic Approach to Training',
 'Lifecycle & delivery', 'required', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, null, 'The Nuclear House',
 'Running competence properly: the systematic approach to training, analysis through to evaluation, competence assurance for safety roles, and the evidence a regulator expects to see behind a SQEP claim.',
 array[
   'Apply the systematic approach to training to a role or task',
   'Carry out a training needs analysis from a competence requirement',
   'Design competence assurance for a safety significant role',
   'Assemble the evidence that supports a SQEP claim for an individual'
 ]),

('independent-verification-oversight',
 'Independent Verification & the Intelligent Customer',
 'Lifecycle & delivery', 'required', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, null, 'The Nuclear House',
 'Independent challenge that is worth having: levels of checking and independence, nuclear safety committee and internal regulation, peer review, and the intelligent customer capability a licensee must keep in house.',
 array[
   'Set a level of independent verification proportionate to safety significance',
   'Carry out an independent technical review and report it usefully',
   'Explain internal regulation and the role of a nuclear safety committee',
   'Describe the intelligent customer capability and why it cannot be contracted out'
 ]),

('fidic-contract-administration',
 'FIDIC Contract Administration',
 'Lifecycle & delivery', 'required', 'virtual', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'Administering a FIDIC contract on a nuclear project: the main forms and where each fits, the engineer''s role, variations, claims and notice periods, and how contractual mechanics interact with nuclear quality requirements.',
 array[
   'Select the appropriate FIDIC form for a scope of work',
   'Administer variations, claims and notices within the contractual time bars',
   'Explain the engineer''s duties and the limits of that role',
   'Reconcile contractual delivery pressure with nuclear quality obligations'
 ]),

-- ===== Project controls & planning (proposed additions) ====================
('integrated-programme-development',
 'Integrated Programme & Schedule Development',
 'Project controls & planning', 'required', 'in_person', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'Building a schedule that can actually be run: work breakdown, logic and sequencing, integrating contractor schedules, and the quality checks that separate a usable programme from a picture.',
 array[
   'Build a work breakdown structure and a logic-linked schedule from it',
   'Integrate contractor and subcontractor schedules into one programme',
   'Apply schedule quality checks and fix what they find',
   'Set a realistic baseline and explain what it commits the project to'
 ]),

('critical-path-network-analysis',
 'Critical Path & Network Analysis',
 'Project controls & planning', 'required', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, null, 'The Nuclear House',
 'Reading a network properly: forward and backward pass, float and its ownership, near critical paths, and the constraints and lags that quietly make a critical path meaningless.',
 array[
   'Calculate a critical path and interpret total and free float',
   'Identify near critical paths and why they matter as much as the critical one',
   'Recognise constraints and lags that distort network logic',
   'Use critical path analysis to target the right recovery action'
 ]),

('earned-value-management',
 'Earned Value Management',
 'Project controls & planning', 'required', 'virtual', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'Earned value that tells the truth: the performance measurement baseline, choosing sensible measurement methods, the standard indices, and forecasting a completion cost that people will believe.',
 array[
   'Establish a performance measurement baseline for a scope of work',
   'Select an appropriate earned value technique for each work package',
   'Calculate and interpret schedule and cost performance indices',
   'Produce a defensible estimate at completion'
 ]),

('schedule-risk-analysis',
 'Schedule Risk Analysis',
 'Project controls & planning', 'required', 'virtual', 'instructor_led', 16,
 'knowledge_check', true, null, 'The Nuclear House',
 'Quantifying schedule uncertainty: duration ranging, risk events, correlation, Monte Carlo simulation, and turning a confidence curve into a contingency people will actually hold.',
 array[
   'Range durations and map risk events onto a schedule',
   'Run a Monte Carlo schedule risk analysis and check it is behaving',
   'Interpret a confidence curve and set contingency from it',
   'Identify the drivers of schedule risk and target mitigation at them'
 ]),

('baseline-change-control',
 'Baseline & Change Control',
 'Project controls & planning', 'required', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, null, 'The Nuclear House',
 'Holding a baseline while the world moves: what belongs in a baseline, change control routes and authority, trend and early warning, and keeping the audit trail from original to current.',
 array[
   'Define a baseline and the authority needed to change it',
   'Operate a change control process with proportionate levels of approval',
   'Use trending and early warning to see change before it lands',
   'Maintain an auditable trail from original baseline to current'
 ]),

('progress-measurement-reporting',
 'Progress Measurement & Reporting',
 'Project controls & planning', 'required', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, null, 'The Nuclear House',
 'Measuring progress honestly and reporting it usefully: physical progress against effort, rules of credit, avoiding the ninety per cent complete trap, and writing a report that supports a decision.',
 array[
   'Select a progress measurement method suited to the type of work',
   'Apply rules of credit consistently across a scope',
   'Recognise and correct optimistic or stalled progress reporting',
   'Write a progress report that leads to a decision rather than a discussion'
 ]),

('resource-capacity-planning',
 'Resource & Capacity Planning',
 'Project controls & planning', 'required', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, null, 'The Nuclear House',
 'Matching people to a programme: resource loading and levelling, capacity against demand across a portfolio, skills and clearance constraints, and what resource limits do to a critical path.',
 array[
   'Resource load a schedule and level it against real availability',
   'Model capacity against demand across more than one project',
   'Account for skills, security clearance and training lead times',
   'Explain the effect of a resource constraint on the critical path'
 ]),

('interface-milestone-management',
 'Interface & Milestone Management',
 'Project controls & planning', 'required', 'virtual', 'instructor_led', 8,
 'knowledge_check', true, null, 'The Nuclear House',
 'Managing the joins: identifying and registering interfaces, defining a milestone so completion is not arguable, and running the agreements between parties that most delays actually come from.',
 array[
   'Identify and register the interfaces on a project',
   'Write a milestone definition with unambiguous completion criteria',
   'Run an interface agreement between two parties to closure',
   'Escalate an interface problem before it reaches the critical path'
 ]),

-- ===== Soft skills (proposed additions) ====================================
('nuclear-leadership-safety-values',
 'Nuclear Leadership & Safety Values in Action',
 'Soft skills', 'required', 'in_person', 'instructor_led', 16,
 'practical_observation', true, null, 'The Nuclear House',
 'Leadership as it is judged in nuclear: setting expectations and being seen to hold them, reinforcing behaviour in the field, and what a leader does when safety and schedule pull against each other.',
 array[
   'Set and communicate safety expectations that people can act on',
   'Reinforce or correct behaviour in the field without damaging trust',
   'Demonstrate leadership behaviours when safety and schedule conflict',
   'Assess the safety culture of your own team honestly'
 ]),

('human-performance-tools',
 'Human Performance Tools & Error Prevention',
 'Soft skills', 'required', 'blended', 'instructor_led', 8,
 'practical_observation', true, 24, 'The Nuclear House',
 'The error prevention toolkit used across the industry: self-check, peer-check, three way communication, procedure use and adherence, pre-job briefing and post-job review, and the error traps that defeat them.',
 array[
   'Apply self-check and peer-check to a safety significant task',
   'Use three way communication correctly under pressure',
   'Run a pre-job brief and a post-job review that change the next job',
   'Recognise the error traps present in your own work'
 ]),

('effective-safety-communication',
 'Effective Safety Communication',
 'Soft skills', 'required', 'in_person', 'instructor_led', 8,
 'practical_observation', true, null, 'The Nuclear House',
 'Communicating safety information so it is acted on: handover and briefing, written clarity in a technical record, escalating a concern, and communicating uncertainty without either alarming or reassuring falsely.',
 array[
   'Give a handover or briefing that transfers the safety significant facts',
   'Write a technical record that a stranger can rely on years later',
   'Escalate a safety concern through the right route and follow it up',
   'Communicate uncertainty accurately to a non-technical audience'
 ]),

-- ===== Awareness modules: the level 2 route across the framework ===========
('awareness-nuclear-fundamentals',
 'Nuclear Fundamentals Awareness',
 'Safety & regulatory', 'required', 'elearning', 'self_paced', 3,
 'knowledge_check', true, 24, 'The Nuclear House',
 'A short self-paced introduction for anyone new to nuclear: why the industry works the way it does, the regulatory landscape, safety culture, and the vocabulary needed to follow a technical conversation.',
 array[
   'Explain why nuclear is regulated the way it is',
   'Use the core vocabulary of nuclear safety correctly',
   'Describe the roles of the regulator, the licensee and the supply chain',
   'Recognise the behaviours a nuclear safety culture expects'
 ]),

('awareness-safety-case-analysis',
 'Safety Case & Analysis Awareness',
 'Safety analysis & assessment', 'required', 'elearning', 'self_paced', 2,
 'knowledge_check', true, 24, 'The Nuclear House',
 'A short self-paced introduction to safety cases and safety analysis for people who will contribute to them without writing them: what a case contains, what the analysis is trying to prove, and where your work fits.',
 array[
   'Describe what a nuclear safety case contains and what it is for',
   'Distinguish deterministic and probabilistic analysis and their purposes',
   'Recognise the language of claims, arguments and evidence',
   'Identify where your own discipline contributes evidence'
 ]),

('awareness-nuclear-technology',
 'Nuclear Technology Awareness',
 'Engineering disciplines', 'required', 'elearning', 'self_paced', 3,
 'knowledge_check', true, 24, 'The Nuclear House',
 'A short self-paced introduction to how nuclear plant works, for engineers coming from another sector: reactor physics in outline, heat removal, materials and radiation, waste, and the language each discipline uses.',
 array[
   'Describe in outline how a reactor produces and removes heat',
   'Explain the effect of radiation on people and on materials',
   'Recognise the main plant systems and what each is for',
   'Follow a technical discussion in a discipline that is not your own'
 ]),

('awareness-project-controls',
 'Project Controls Awareness',
 'Project controls & planning', 'required', 'elearning', 'self_paced', 2,
 'knowledge_check', true, null, 'The Nuclear House',
 'A short self-paced introduction to project controls for engineers and managers who are measured by them: what a schedule and a baseline are, how progress and cost are tracked, and how to read the reports.',
 array[
   'Read a schedule and identify the critical path',
   'Explain what a baseline is and why changing it matters',
   'Interpret a progress and earned value report',
   'Describe how your own work becomes data in the project controls system'
 ]),

-- ===== Development routes that are not courses =============================
('supervised-practice-td',
 'Supervised Practice with a Technical Director',
 'Lifecycle & delivery', 'active', 'on_the_job', 'instructor_led', 40,
 'practical_observation', false, null, 'The Nuclear House',
 'Real work on live projects under the supervision of a Technical Director, with the output reviewed and the judgement tested. This is the route to full competence: a course can build knowledge, but only supervised practice evidences that someone can be relied on unsupervised.',
 array[
   'Apply the competency to live project work under supervision',
   'Produce output that withstands independent technical review',
   'Exercise and defend engineering judgement in a real decision',
   'Build the evidence record that supports a SQEP claim'
 ]),

('expert-mentoring-peer-review',
 'Expert Development: Mentoring & Independent Peer Review',
 'Lifecycle & delivery', 'active', 'coaching', 'instructor_led', 40,
 'portfolio', false, null, 'The Nuclear House',
 'The route beyond full competence: mentoring others, sitting on independent peer reviews, and contributing to industry or standards work. Expertise is demonstrated by being trusted to judge other people''s work, not by attending anything.',
 array[
   'Mentor a less experienced practitioner to a measurable improvement',
   'Sit on an independent peer review and challenge credibly',
   'Adapt method and approach where standard practice does not fit',
   'Represent the organisation on the competency externally'
 ])

on conflict (code) do update set
  title              = excluded.title,
  family             = excluded.family,
  status             = excluded.status,
  delivery_mode      = excluded.delivery_mode,
  pacing             = excluded.pacing,
  duration_hours     = excluded.duration_hours,
  assessment_method  = excluded.assessment_method,
  issues_certificate = excluded.issues_certificate,
  validity_months    = excluded.validity_months,
  provider           = excluded.provider,
  description        = excluded.description,
  outcomes           = excluded.outcomes;


-- ----------------------------------------------------------------------------
-- 4. Learning paths: which training reaches which level of which competency.
--    Cleared and rebuilt for coded trainings only, so anything you attached by
--    hand to an uncoded training survives.
-- ----------------------------------------------------------------------------
delete from public.competency_level_trainings
where training_id in (select id from public.trainings where code is not null);

insert into public.competency_level_trainings (competency_id, level, training_id)
select c.id, m.level, t.id
from (values
  -- Engineering disciplines
  ('work-processes',                              3, 'dfma-in-nuclear'),
  ('electrical-power-systems',                    3, 'eci-in-nuclear'),
  ('c-i-safety-systems',                          3, 'eci-in-nuclear'),
  ('safety-functional-requirements-derivation',   3, 'systems-engineering-nuclear'),
  ('interface-milestone-management',              3, 'systems-engineering-nuclear'),
  ('pressure-systems-containment',                3, 'mechanical-engineering-nuclear'),
  ('materials-degradation-mechanisms',            2, 'mechanical-engineering-nuclear'),
  ('structural-integrity-assessment',             2, 'civil-structural-nuclear'),
  ('internal-external-hazards-analysis',          2, 'civil-structural-nuclear'),
  ('radiological-protection-awareness',           3, 'hvac-in-nuclear'),
  ('materials-degradation-mechanisms',            3, 'materials-welding-nuclear'),
  ('structural-integrity-assessment',             3, 'materials-welding-nuclear'),

  -- Safety & regulatory
  ('health-safety-law-and-alarp',                 3, 'iosh-managing-safely-nuclear'),
  ('personal-accountability',                     3, 'iosh-managing-safely-nuclear'),
  ('work-processes',                              2, 'iosh-nuclear-upskill-1day'),
  ('radiological-protection-awareness',           2, 'iosh-nuclear-upskill-1day'),
  ('alarp-demonstration',                         4, 'alarp-in-practice'),
  ('health-safety-law-and-alarp',                 4, 'alarp-in-practice'),
  ('alarp-demonstration',                         3, 'alarp-in-practice'),
  ('defence-in-depth',                            3, 'defence-in-depth-for-design'),
  ('fundamental-safety-principles',               3, 'defence-in-depth-for-design'),
  ('health-safety-law-and-alarp',                 2, 'cdm-2015-nuclear-designers'),
  ('human-factors-integration',                   3, 'human-factors-nuclear-design'),
  ('human-reliability-analysis',                  2, 'human-factors-nuclear-design'),
  ('fault-identification-fault-schedule',         3, 'fault-studies-consequence-analysis'),
  ('design-basis-analysis',                       3, 'fault-studies-consequence-analysis'),
  ('safety-case-structure-golden-thread',         3, 'safety-case-fundamentals-engineers'),
  ('safety-case-production-maintenance',          3, 'safety-case-fundamentals-engineers'),
  ('fundamental-safety-principles',               2, 'safety-case-fundamentals-engineers'),

  -- Lifecycle & delivery
  ('decommissioning-strategy-delivery',           3, 'design-for-decommissioning'),
  ('radioactive-waste-characterisation-routes',   2, 'design-for-decommissioning'),
  ('configuration-document-management',           3, 'nuclear-configuration-management'),
  ('baseline-change-control',                     2, 'nuclear-configuration-management'),
  ('safety-functional-requirements-derivation',   2, 'requirements-management-nuclear'),
  ('interface-milestone-management',              2, 'requirements-management-nuclear'),
  ('independent-verification-oversight',          3, 'supply-chain-quality-nuclear'),
  ('configuration-document-management',           2, 'supply-chain-quality-nuclear'),
  ('nuclear-licensing-licence-conditions',        2, 'nuclear-project-lifecycle-gda-ops'),
  ('onr-safety-assessment-principles',            2, 'nuclear-project-lifecycle-gda-ops'),
  ('integrated-programme-schedule-development',   2, 'nuclear-project-lifecycle-gda-ops'),

  -- Operational awareness for designers
  ('dose-assessment-modelling',                   2, 'radiation-protection-fundamentals-engineers'),
  ('radiation-environmental-regulations',         2, 'radiation-protection-fundamentals-engineers'),
  ('work-processes',                              3, 'nuclear-operations-for-designers'),
  ('alarp-demonstration',                         2, 'maintenance-inspection-access-design'),
  ('integrated-programme-schedule-development',   2, 'outage-planning-awareness'),
  ('resource-capacity-planning',                  2, 'outage-planning-awareness'),
  ('reactor-theory-neutronics',                   2, 'pwr-reactor-operations'),
  ('core-design-fuel-management',                 2, 'pwr-reactor-operations'),
  ('thermal-hydraulic-analysis',                  2, 'pwr-reactor-operations'),
  ('coolant-plant-chemistry',                     2, 'pwr-reactor-operations'),

  -- Soft skills
  ('personal-accountability',                     2, 'nuclear-safety-culture'),
  ('questioning-attitude',                        3, 'nuclear-safety-culture'),
  ('leadership-safety-values-actions',            2, 'nuclear-safety-culture'),
  ('environment-for-raising-concerns',            3, 'nuclear-safety-culture'),
  ('continuous-learning',                         2, 'nuclear-safety-culture'),
  ('effective-safety-communication',              4, 'communicating-with-regulators'),
  ('onr-safety-assessment-principles',            3, 'communicating-with-regulators'),
  ('conservative-decision-making',                4, 'engineering-decision-making'),
  ('questioning-attitude',                        4, 'engineering-decision-making'),
  ('conservative-decision-making',                3, 'engineering-decision-making'),
  ('continuous-learning',                         3, 'learning-from-events-opex'),
  ('problem-identification-resolution',           3, 'learning-from-events-opex'),
  ('respectful-work-environment',                 3, 'conflict-management'),
  ('environment-for-raising-concerns',            4, 'conflict-management'),
  ('questioning-attitude',                        2, 'critical-thinking-prioritisation'),
  ('problem-identification-resolution',           2, 'critical-thinking-prioritisation'),

  -- Safety analysis & assessment
  ('onr-safety-assessment-principles',            4, 'sap-application-in-practice'),
  ('safety-case-production-maintenance',          3, 'sap-application-in-practice'),
  ('categorisation-classification',               3, 'categorisation-classification'),
  ('safety-functional-requirements-derivation',   4, 'categorisation-classification'),
  ('internal-external-hazards-analysis',          3, 'internal-external-hazards-analysis'),
  ('probabilistic-safety-assessment',             3, 'psa-fundamentals'),
  ('probabilistic-safety-assessment',             2, 'psa-fundamentals'),
  ('probabilistic-safety-assessment',             4, 'psa-practitioner'),
  ('criticality-safety-assessment',               3, 'criticality-safety-assessment'),
  ('criticality-safety-assessment',               4, 'criticality-safety-assessment'),
  ('human-reliability-analysis',                  3, 'human-reliability-analysis'),
  ('shielding-design-source-term',                3, 'shielding-source-term-design'),
  ('shielding-design-source-term',                4, 'shielding-source-term-design'),
  ('dose-assessment-modelling',                   3, 'dose-assessment-modelling'),
  ('safety-case-structure-golden-thread',         4, 'safety-case-golden-thread-practitioner'),
  ('safety-case-production-maintenance',          4, 'safety-case-golden-thread-practitioner'),
  ('design-basis-analysis',                       4, 'design-basis-analysis-practitioner'),
  ('fault-identification-fault-schedule',         4, 'design-basis-analysis-practitioner'),

  -- Engineering disciplines (additions)
  ('reactor-theory-neutronics',                   3, 'reactor-theory-neutronics'),
  ('reactor-theory-neutronics',                   4, 'reactor-theory-neutronics'),
  ('core-design-fuel-management',                 3, 'core-design-fuel-management'),
  ('core-design-fuel-management',                 4, 'core-design-fuel-management'),
  ('thermal-hydraulic-analysis',                  3, 'thermal-hydraulic-analysis'),
  ('thermal-hydraulic-analysis',                  4, 'thermal-hydraulic-analysis'),
  ('coolant-plant-chemistry',                     3, 'coolant-plant-chemistry'),
  ('structural-integrity-assessment',             4, 'structural-integrity-assessment'),
  ('pressure-systems-containment',                4, 'pressure-systems-containment'),
  ('computer-based-systems-software-reliability', 3, 'computer-based-safety-systems'),
  ('computer-based-systems-software-reliability', 4, 'computer-based-safety-systems'),
  ('c-i-safety-systems',                          4, 'computer-based-safety-systems'),

  -- Safety & regulatory (additions)
  ('security-safeguards-awareness',               3, 'nuclear-security-safeguards'),
  ('security-safeguards-awareness',               4, 'nuclear-security-safeguards'),
  ('radiation-environmental-regulations',         3, 'radiation-environmental-regulations'),
  ('radiation-environmental-regulations',         4, 'radiation-environmental-regulations'),
  ('nuclear-licensing-licence-conditions',        3, 'licensing-licence-conditions'),
  ('nuclear-licensing-licence-conditions',        4, 'licensing-licence-conditions'),
  ('iaea-industry-standards',                     2, 'iaea-industry-standards'),
  ('iaea-industry-standards',                     3, 'iaea-industry-standards'),
  ('defence-in-depth',                            2, 'emergency-preparedness-response'),

  -- Lifecycle & delivery (additions)
  ('radioactive-waste-characterisation-routes',   3, 'radioactive-waste-routes'),
  ('radioactive-waste-characterisation-routes',   4, 'radioactive-waste-routes'),
  ('decommissioning-strategy-delivery',           4, 'decommissioning-strategy-delivery'),
  ('competence-management-sat',                   3, 'sat-competence-management'),
  ('competence-management-sat',                   4, 'sat-competence-management'),
  ('independent-verification-oversight',          4, 'independent-verification-oversight'),
  ('fidic-contract-administration',               3, 'fidic-contract-administration'),
  ('fidic-contract-administration',               4, 'fidic-contract-administration'),

  -- Project controls & planning (additions)
  ('integrated-programme-schedule-development',   3, 'integrated-programme-development'),
  ('integrated-programme-schedule-development',   4, 'integrated-programme-development'),
  ('critical-path-network-analysis',              3, 'critical-path-network-analysis'),
  ('critical-path-network-analysis',              4, 'critical-path-network-analysis'),
  ('earned-value-management',                     3, 'earned-value-management'),
  ('earned-value-management',                     4, 'earned-value-management'),
  ('schedule-risk-analysis',                      3, 'schedule-risk-analysis'),
  ('schedule-risk-analysis',                      4, 'schedule-risk-analysis'),
  ('baseline-change-control',                     3, 'baseline-change-control'),
  ('baseline-change-control',                     4, 'baseline-change-control'),
  ('progress-measurement-reporting',              3, 'progress-measurement-reporting'),
  ('progress-measurement-reporting',              4, 'progress-measurement-reporting'),
  ('resource-capacity-planning',                  3, 'resource-capacity-planning'),
  ('resource-capacity-planning',                  4, 'resource-capacity-planning'),
  ('interface-milestone-management',              4, 'interface-milestone-management'),

  -- Soft skills (additions)
  ('leadership-safety-values-actions',            3, 'nuclear-leadership-safety-values'),
  ('leadership-safety-values-actions',            4, 'nuclear-leadership-safety-values'),
  ('work-processes',                              4, 'human-performance-tools'),
  ('personal-accountability',                     4, 'human-performance-tools'),
  ('problem-identification-resolution',           4, 'human-performance-tools'),
  ('effective-safety-communication',              3, 'effective-safety-communication'),
  ('effective-safety-communication',              2, 'effective-safety-communication')
) as m(comp_code, level, training_code)
join public.competencies c on c.code = m.comp_code
join public.trainings   t on t.code = m.training_code
on conflict (competency_id, level, training_id) do nothing;


-- ----------------------------------------------------------------------------
-- 5. Level 2 (Awareness) fallback, by category, where no course already covers it.
-- ----------------------------------------------------------------------------
insert into public.competency_level_trainings (competency_id, level, training_id)
select c.id, 2, t.id
from public.competencies c
join public.competency_categories cat on cat.id = c.category_id
join public.trainings t on t.code = case
  when cat.name in ('Nuclear Safety Culture', 'Nuclear Safety Fundamentals',
                    'Regulatory & Legal Framework', 'Quality & Assurance')
    then 'awareness-nuclear-fundamentals'
  when cat.name in ('Safety Case & Assessment', 'Fault & Accident Analysis',
                    'Human & Organisational Factors')
    then 'awareness-safety-case-analysis'
  when cat.name in ('Project Controls & Planning')
    then 'awareness-project-controls'
  else 'awareness-nuclear-technology'
end
where not exists (
  select 1 from public.competency_level_trainings x
  where x.competency_id = c.id and x.level = 2
)
on conflict (competency_id, level, training_id) do nothing;


-- ----------------------------------------------------------------------------
-- 6. Levels 4 and 5. A course builds knowledge; supervised practice is what
--    evidences competence, and expertise is demonstrated by judging others'
--    work. Applied only where nothing already fills the level.
-- ----------------------------------------------------------------------------
insert into public.competency_level_trainings (competency_id, level, training_id)
select c.id, 4, t.id
from public.competencies c
cross join public.trainings t
where t.code = 'supervised-practice-td'
  and not exists (
    select 1 from public.competency_level_trainings x
    where x.competency_id = c.id and x.level = 4
  )
on conflict (competency_id, level, training_id) do nothing;

insert into public.competency_level_trainings (competency_id, level, training_id)
select c.id, 5, t.id
from public.competencies c
cross join public.trainings t
where t.code = 'expert-mentoring-peer-review'
  and not exists (
    select 1 from public.competency_level_trainings x
    where x.competency_id = c.id and x.level = 5
  )
on conflict (competency_id, level, training_id) do nothing;


-- ----------------------------------------------------------------------------
-- 7. Checks. Run these after the script and read the results.
-- ----------------------------------------------------------------------------

-- How the catalogue came out, by family and status.
select family, status, count(*) as trainings
from public.trainings group by family, status order by family, status;

-- Any competency with a hole in its ladder. Every row here is a level a
-- consultant cannot be taken to, and will show as "Training Missing" on a plan.
select c.code, c.name, lv.level as missing_level
from public.competencies c
cross join (values (2), (3), (4), (5)) as lv(level)
where not exists (
  select 1 from public.competency_level_trainings x
  where x.competency_id = c.id and x.level = lv.level
)
order by c.name, lv.level;

-- Any training that reaches nothing, so the plan builder can never use it.
select code, title from public.trainings t
where not exists (select 1 from public.competency_level_trainings x where x.training_id = t.id)
order by title;
