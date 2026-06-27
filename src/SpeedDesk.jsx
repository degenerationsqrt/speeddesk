import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CATEGORIES = [
  "Acceleration",
  "Max Velocity",
  "Agility",
  "Deceleration",
  "Plyometrics",
  "Ball Mastery",
  "Recovery",
];

const CATEGORY_COLORS = {
  Acceleration: "#f97316",
  "Max Velocity": "#38bdf8",
  Agility: "#22c55e",
  Deceleration: "#f43f5e",
  Plyometrics: "#f6c453",
  "Ball Mastery": "#a3e635",
  Recovery: "#94a3b8",
};

const SOURCE_LABELS = {
  workbook: "Training Workbook.xlsx",
  drills: "DRILLS.xlsx",
  closeControl: "Close_Control_Dribbling_Tracker.xlsx",
  advancedTouch: "Advanced_Technical_Touch_Tracker.xlsx",
  plyoDoc: "Plyometric Drills.docx",
  overtime: "Overtime Athletes soccer speed PDF",
  plylo: "PLYLO.pdf",
  scanned: "Scanned plyometric/agility PDF",
  stanford: "stanfordfitness.pdf",
};

const DRILLS = [
  {
    id: "wall-drill",
    name: "Wall Drill Series",
    category: "Acceleration",
    level: "Beginner",
    dose: "3 x 10 switches each leg",
    equipment: "Wall or fence",
    metric: "switches",
    source: SOURCE_LABELS.overtime,
    cues: ["Forward lean from ankle to shoulder", "Punch the knee up", "Pull the foot back under the hip"],
  },
  {
    id: "partner-release",
    name: "Partner Release Starts",
    category: "Acceleration",
    level: "Intermediate",
    dose: "4 to 6 starts x 10 yd",
    equipment: "Partner",
    metric: "time",
    source: SOURCE_LABELS.overtime,
    cues: ["Push hard before release", "Keep shin angle low", "Sprint out without popping upright"],
  },
  {
    id: "two-point-10",
    name: "2-Point 10 Yard Starts",
    category: "Acceleration",
    level: "All Levels",
    dose: "6 x 10 yd, full rest",
    equipment: "Cones",
    metric: "time",
    source: SOURCE_LABELS.overtime,
    cues: ["Set hips tall", "First three steps are violent", "Stop before mechanics fade"],
  },
  {
    id: "falling-start",
    name: "Falling Start to Sprint",
    category: "Acceleration",
    level: "All Levels",
    dose: "4 x 10 m, 3 x 20 m",
    equipment: "Cones",
    metric: "time",
    source: SOURCE_LABELS.workbook,
    cues: ["Lean until the step has to happen", "Punch the ground back", "Build, do not stumble"],
  },
  {
    id: "sled-pull",
    name: "Sprint Sled Pulls",
    category: "Acceleration",
    level: "Intermediate",
    dose: "5 x 10 m at 15-25% BW",
    equipment: "Sled or bands",
    metric: "time",
    source: SOURCE_LABELS.workbook,
    cues: ["Stay low", "Push the ground behind you", "Use load only if speed stays crisp"],
  },
  {
    id: "power-skips-distance",
    name: "Power Skips for Distance",
    category: "Acceleration",
    level: "Intermediate",
    dose: "3 x 20 m",
    equipment: "Open lane",
    metric: "distance",
    source: SOURCE_LABELS.overtime,
    cues: ["Opposite arm and leg", "Float each stride", "Cover ground without reaching"],
  },
  {
    id: "stagger-broad",
    name: "Staggered Stance Broad Jump",
    category: "Acceleration",
    level: "Intermediate",
    dose: "4 x 4 jumps",
    equipment: "Open lane",
    metric: "distance",
    source: SOURCE_LABELS.overtime,
    cues: ["Start split like the first sprint step", "Finish hip extension", "Stick the landing"],
  },
  {
    id: "a-skip",
    name: "A-Skips",
    category: "Max Velocity",
    level: "All Levels",
    dose: "3 x 20 m",
    equipment: "Open lane",
    metric: "quality",
    source: SOURCE_LABELS.workbook,
    cues: ["Pop the thigh", "Dorsiflex the toe", "Pull down with the glute"],
  },
  {
    id: "b-skip",
    name: "B-Skips",
    category: "Max Velocity",
    level: "Intermediate",
    dose: "3 x 20 m",
    equipment: "Open lane",
    metric: "quality",
    source: SOURCE_LABELS.overtime,
    cues: ["Pop then release", "Avoid reaching", "Keep rhythm smooth"],
  },
  {
    id: "straight-leg-bounds",
    name: "Straight Leg Bounds",
    category: "Max Velocity",
    level: "Intermediate",
    dose: "3 x 20 m",
    equipment: "Open lane",
    metric: "distance",
    source: SOURCE_LABELS.overtime,
    cues: ["Tall hips", "Pull through the ground", "Do not cast the foot too far out"],
  },
  {
    id: "power-a-skip",
    name: "Power A-Skip",
    category: "Max Velocity",
    level: "Intermediate",
    dose: "3 x 20 m",
    equipment: "Open lane",
    metric: "distance",
    source: SOURCE_LABELS.overtime,
    cues: ["A-skip rhythm", "Add horizontal pop", "Land under the body"],
  },
  {
    id: "power-skips-height",
    name: "Power Skips for Height",
    category: "Max Velocity",
    level: "Intermediate",
    dose: "3 x 20 yd",
    equipment: "Open lane",
    metric: "height",
    source: SOURCE_LABELS.overtime,
    cues: ["Get vertical", "Opposite arm drive", "Quick off the ground"],
  },
  {
    id: "sprinter-step-ups",
    name: "Sprinter Step-Ups",
    category: "Max Velocity",
    level: "Intermediate",
    dose: "3 x 6 each leg",
    equipment: "Box",
    metric: "reps",
    source: SOURCE_LABELS.overtime,
    cues: ["Use a 90-degree box height", "Drive opposite arm", "Control the return"],
  },
  {
    id: "fly-in",
    name: "Fly-In Sprints",
    category: "Max Velocity",
    level: "Advanced",
    dose: "4 to 6 fly reps",
    equipment: "Timing gates or cones",
    metric: "time",
    source: SOURCE_LABELS.workbook,
    cues: ["Build in smoothly", "Time only the fly zone", "Full rest between reps"],
  },
  {
    id: "lateral-line-hops",
    name: "Lateral Line Hops",
    category: "Agility",
    level: "Beginner",
    dose: "3 x 10 sec",
    equipment: "Line",
    metric: "contacts",
    source: SOURCE_LABELS.overtime,
    cues: ["Center of gravity over the line", "Soft knee", "Fast touches"],
  },
  {
    id: "lateral-cone-hops",
    name: "Lateral Cone Hops",
    category: "Agility",
    level: "Intermediate",
    dose: "3 x down-and-back",
    equipment: "3 cones",
    metric: "contacts",
    source: SOURCE_LABELS.overtime,
    cues: ["Land in line with each cone", "No long pause", "Progress cone spacing slowly"],
  },
  {
    id: "short-lateral-shuttle",
    name: "Short Lateral Shuttle",
    category: "Agility",
    level: "All Levels",
    dose: "4 each direction",
    equipment: "3 cones, 7 ft apart",
    metric: "time",
    source: SOURCE_LABELS.overtime,
    cues: ["Start from the middle", "Absorb the outside cut", "Finish back through the middle"],
  },
  {
    id: "skater-jumps",
    name: "Skater Jumps",
    category: "Agility",
    level: "All Levels",
    dose: "3 x 6 each side",
    equipment: "Open space",
    metric: "distance",
    source: SOURCE_LABELS.overtime,
    cues: ["Push up and out", "Stick each landing", "Knee tracks over toes"],
  },
  {
    id: "ascending-skater",
    name: "Ascending Skater Jumps",
    category: "Agility",
    level: "Advanced",
    dose: "3 x 5 each side",
    equipment: "Open space",
    metric: "distance",
    source: SOURCE_LABELS.overtime,
    cues: ["Jump far, return half-way", "Absorb cleanly", "Keep torso stacked"],
  },
  {
    id: "mirror-drill",
    name: "Mirror Drill",
    category: "Agility",
    level: "All Levels",
    dose: "4 x 20 sec",
    equipment: "Partner",
    metric: "reaction",
    source: SOURCE_LABELS.workbook,
    cues: ["React, do not predict", "Stay low", "Switch leader after each rep"],
  },
  {
    id: "five-ten-five",
    name: "5-10-5 Shuttle",
    category: "Agility",
    level: "All Levels",
    dose: "4 timed reps",
    equipment: "3 cones",
    metric: "time",
    source: SOURCE_LABELS.drills,
    cues: ["Touch the line", "Load the outside leg", "Accelerate out of every turn"],
  },
  {
    id: "x-drill",
    name: "X Drill",
    category: "Agility",
    level: "Intermediate",
    dose: "15 min block",
    equipment: "4 cones",
    metric: "time",
    source: SOURCE_LABELS.workbook,
    cues: ["Sprint diagonals", "Shuffle laterals", "Reset posture at every cone"],
  },
  {
    id: "v-drill",
    name: "V Drill",
    category: "Agility",
    level: "Intermediate",
    dose: "15 min block",
    equipment: "3 cones",
    metric: "time",
    source: SOURCE_LABELS.workbook,
    cues: ["Plant outside foot", "Open hips", "Exit low"],
  },
  {
    id: "sprint-stop-sprint",
    name: "Sprint-Stop-Sprint",
    category: "Deceleration",
    level: "Intermediate",
    dose: "5 x 15-20 m",
    equipment: "Cones",
    metric: "control",
    source: SOURCE_LABELS.workbook,
    cues: ["Brake in steps, not a skid", "Chest over hips", "Re-accelerate only after control"],
  },
  {
    id: "auditory-reaction",
    name: "Auditory Reaction Sprints",
    category: "Deceleration",
    level: "All Levels",
    dose: "6 to 8 random starts",
    equipment: "Partner",
    metric: "reaction",
    source: SOURCE_LABELS.drills,
    cues: ["Wait for the call", "First step wins", "Record reaction if timed"],
  },
  {
    id: "depth-jump-sprint",
    name: "Depth Jump + Sprint",
    category: "Deceleration",
    level: "Advanced",
    dose: "4 x 3 contacts + 10 m",
    equipment: "Box",
    metric: "time",
    source: SOURCE_LABELS.workbook,
    cues: ["High CNS load", "Stiff, fast contact", "Stop when pop drops"],
  },
  {
    id: "ankle-hop",
    name: "Two-Foot Ankle Hop",
    category: "Plyometrics",
    level: "Beginner",
    dose: "2 x 10",
    equipment: "Open space",
    metric: "contacts",
    source: SOURCE_LABELS.plyoDoc,
    cues: ["Motion comes mostly from ankles", "Minimal forward drift", "Repeat quickly"],
  },
  {
    id: "squat-jump",
    name: "Squat Jump",
    category: "Plyometrics",
    level: "Beginner",
    dose: "3 x 5",
    equipment: "Open space",
    metric: "height",
    source: SOURCE_LABELS.plyoDoc,
    cues: ["Start in squat", "Jump for max height", "Land in the start position"],
  },
  {
    id: "jump-reach",
    name: "Jump and Reach",
    category: "Plyometrics",
    level: "Beginner",
    dose: "3 x 5",
    equipment: "Target",
    metric: "height",
    source: SOURCE_LABELS.plyoDoc,
    cues: ["Use a small countermovement", "Reach tall", "Spend little time on the ground"],
  },
  {
    id: "tuck-jump",
    name: "Double-Leg Tuck Jump",
    category: "Plyometrics",
    level: "Intermediate",
    dose: "3 x 5",
    equipment: "Open space",
    metric: "contacts",
    source: SOURCE_LABELS.plyoDoc,
    cues: ["Bring knees to chest", "Release before landing", "Land soft and aligned"],
  },
  {
    id: "split-squat-jump",
    name: "Split Squat Jump",
    category: "Plyometrics",
    level: "Intermediate",
    dose: "2 x 6 each leg",
    equipment: "Open space",
    metric: "contacts",
    source: SOURCE_LABELS.plyoDoc,
    cues: ["Lunge stance", "Jump without collapsing", "Rest before switching legs"],
  },
  {
    id: "double-leg-hop",
    name: "Double-Leg Hop",
    category: "Plyometrics",
    level: "Intermediate",
    dose: "3 x 3 to 5 hops",
    equipment: "Open lane",
    metric: "distance",
    source: SOURCE_LABELS.plyoDoc,
    cues: ["Jump forward", "Repeat immediately", "Stick posture through the series"],
  },
  {
    id: "zigzag-hop",
    name: "Double-Leg Zigzag Hop",
    category: "Plyometrics",
    level: "Intermediate",
    dose: "3 x 6 hurdles",
    equipment: "Cones or mini hurdles",
    metric: "contacts",
    source: SOURCE_LABELS.plyoDoc,
    cues: ["Diagonal path", "Shoulders stay square", "Quick contacts"],
  },
  {
    id: "single-leg-hop",
    name: "Single-Leg Hop",
    category: "Plyometrics",
    level: "Advanced",
    dose: "3 x 10-20 m each leg",
    equipment: "Open lane",
    metric: "distance",
    source: SOURCE_LABELS.plyoDoc,
    cues: ["Hop forward on one leg", "Use arm swing", "Match quality side to side"],
  },
  {
    id: "lateral-barrier-hop",
    name: "Lateral Barrier Hop",
    category: "Plyometrics",
    level: "Intermediate",
    dose: "3 x 10 sec",
    equipment: "Cone or hurdle",
    metric: "contacts",
    source: SOURCE_LABELS.plyoDoc,
    cues: ["Jump side to side", "Keep feet together", "Progress barrier height slowly"],
  },
  {
    id: "jump-to-box",
    name: "Jump to Box",
    category: "Plyometrics",
    level: "Beginner",
    dose: "3 x 5",
    equipment: "Box",
    metric: "height",
    source: SOURCE_LABELS.plyoDoc,
    cues: ["Countermovement", "Land in half squat", "Step down between reps"],
  },
  {
    id: "lateral-box-jump",
    name: "Lateral Box Jump",
    category: "Plyometrics",
    level: "Intermediate",
    dose: "3 x 5 each side",
    equipment: "Box",
    metric: "height",
    source: SOURCE_LABELS.plyoDoc,
    cues: ["Start beside the box", "Jump onto the top", "Step down and repeat opposite direction"],
  },
  {
    id: "standing-triple",
    name: "Standing Triple Jump",
    category: "Plyometrics",
    level: "Advanced",
    dose: "3 to 5 attempts",
    equipment: "Mat or pit",
    metric: "distance",
    source: SOURCE_LABELS.scanned,
    cues: ["Push from both feet", "Hop-step-jump sequence", "Measure best controlled landing"],
  },
  {
    id: "cone-dribble",
    name: "Cone Dribbling",
    category: "Ball Mastery",
    level: "Beginner",
    dose: "3 rounds",
    equipment: "Cones and ball",
    metric: "quality",
    source: SOURCE_LABELS.drills,
    cues: ["Use inside, outside, and sole", "Short touches", "Build speed only after control"],
  },
  {
    id: "figure-8",
    name: "Figure-8 Dribbling",
    category: "Ball Mastery",
    level: "Beginner",
    dose: "3 x 45 sec",
    equipment: "2 cones and ball",
    metric: "touches",
    source: SOURCE_LABELS.drills,
    cues: ["Both feet", "Smooth rhythm", "Tight turns around each cone"],
  },
  {
    id: "slalom-turns",
    name: "Cone Slalom with Turns",
    category: "Ball Mastery",
    level: "Intermediate",
    dose: "3 rounds each turn",
    equipment: "Cones and ball",
    metric: "time",
    source: SOURCE_LABELS.drills,
    cues: ["Use hooks, cuts, and turns", "Change direction sharply", "Keep the ball close"],
  },
  {
    id: "juggling",
    name: "Juggling Progression",
    category: "Ball Mastery",
    level: "All Levels",
    dose: "5 min touch block",
    equipment: "Ball",
    metric: "touches",
    source: SOURCE_LABELS.drills,
    cues: ["Feet first", "Add thigh, chest, head", "Beat the best touch streak"],
  },
  {
    id: "la-croqueta",
    name: "La Croqueta Series",
    category: "Ball Mastery",
    level: "Intermediate",
    dose: "3x each pattern",
    equipment: "Ball",
    metric: "quality",
    source: SOURCE_LABELS.drills,
    cues: ["Move the ball across the body", "Exit with intent", "Train both directions"],
  },
  {
    id: "v-cut",
    name: "Inside and Outside V Cut",
    category: "Ball Mastery",
    level: "Intermediate",
    dose: "3x each foot",
    equipment: "Ball",
    metric: "quality",
    source: SOURCE_LABELS.drills,
    cues: ["Pull into the V", "Push out cleanly", "Keep eyes up between touches"],
  },
  {
    id: "right-foot-only-close",
    name: "Right Foot Only Close Control",
    category: "Ball Mastery",
    level: "Beginner",
    dose: "60 sec",
    equipment: "Ball",
    metric: "touches",
    source: SOURCE_LABELS.closeControl,
    tpm: 120,
    cues: ["Keep the ball within 1 yard", "Use all right-foot surfaces", "Stay springy with a slight knee bend"],
  },
  {
    id: "left-foot-only-close",
    name: "Left Foot Only Close Control",
    category: "Ball Mastery",
    level: "Beginner",
    dose: "60 sec",
    equipment: "Ball",
    metric: "touches",
    source: SOURCE_LABELS.closeControl,
    tpm: 120,
    cues: ["Build non-dominant confidence", "Lock the ankle on outside pushes", "Match right-foot rhythm"],
  },
  {
    id: "outside-touches-lr",
    name: "Outside Touches L/R",
    category: "Ball Mastery",
    level: "Beginner",
    dose: "45 sec",
    equipment: "Ball",
    metric: "touches",
    source: SOURCE_LABELS.closeControl,
    tpm: 110,
    cues: ["Turn the toe slightly inward", "Push the ball laterally", "Stay ready to evade tight pressure"],
  },
  {
    id: "inside-pendulum",
    name: "Inside Touches Pendulum",
    category: "Ball Mastery",
    level: "Beginner",
    dose: "45 sec",
    equipment: "Ball",
    metric: "touches",
    source: SOURCE_LABELS.closeControl,
    tpm: 140,
    cues: ["Cushion each inside touch", "Shift side to side rapidly", "Keep the ball under the hips"],
  },
  {
    id: "croquetas-lr",
    name: "Croquetas L/R",
    category: "Ball Mastery",
    level: "Intermediate",
    dose: "60 sec",
    equipment: "Ball",
    metric: "touches",
    source: SOURCE_LABELS.closeControl,
    tpm: 100,
    cues: ["Explosive double touch across the body", "Move before the defender commits", "Keep the second touch playable"],
  },
  {
    id: "ball-rolls-lr",
    name: "Ball Rolls L/R",
    category: "Ball Mastery",
    level: "Beginner",
    dose: "45 sec",
    equipment: "Ball",
    metric: "touches",
    source: SOURCE_LABELS.closeControl,
    tpm: 90,
    cues: ["Reach over the top of the ball", "Drag across body center", "Keep the upper body quiet"],
  },
  {
    id: "drag-backs-v-pulls",
    name: "Drag Backs / V-Pulls",
    category: "Ball Mastery",
    level: "Intermediate",
    dose: "45 sec",
    equipment: "Ball",
    metric: "touches",
    source: SOURCE_LABELS.closeControl,
    tpm: 80,
    cues: ["Pull with the sole", "Open the hips instantly", "Exit at 90 or 180 degrees"],
  },
  {
    id: "stepovers-accelerate",
    name: "Step Overs & Accelerate",
    category: "Ball Mastery",
    level: "Intermediate",
    dose: "60 sec",
    equipment: "Ball",
    metric: "touches",
    source: SOURCE_LABELS.closeControl,
    tpm: 70,
    cues: ["Drop the shoulder low", "Sell the feint", "Explode with an outside exit touch"],
  },
  {
    id: "croqueta-right-drive",
    name: "Croqueta to Right-Foot Drive",
    category: "Ball Mastery",
    level: "Intermediate",
    dose: "60 sec",
    equipment: "Ball",
    metric: "touches",
    source: SOURCE_LABELS.closeControl,
    tpm: 85,
    cues: ["Shift across the body", "Push forward with the right instep", "Accelerate seamlessly"],
  },
  {
    id: "croqueta-left-drive",
    name: "Croqueta to Left-Foot Drive",
    category: "Ball Mastery",
    level: "Intermediate",
    dose: "60 sec",
    equipment: "Ball",
    metric: "touches",
    source: SOURCE_LABELS.closeControl,
    tpm: 85,
    cues: ["Shift across the body", "Push forward with the left instep", "Make the weak-side transition clean"],
  },
  {
    id: "ball-roll-right-drive",
    name: "Ball Roll to Right-Foot Drive",
    category: "Ball Mastery",
    level: "Intermediate",
    dose: "60 sec",
    equipment: "Ball",
    metric: "touches",
    source: SOURCE_LABELS.closeControl,
    tpm: 80,
    cues: ["Roll across defender momentum", "Drive with the right instep", "Get out of the move quickly"],
  },
  {
    id: "ball-roll-left-drive",
    name: "Ball Roll to Left-Foot Drive",
    category: "Ball Mastery",
    level: "Intermediate",
    dose: "60 sec",
    equipment: "Ball",
    metric: "touches",
    source: SOURCE_LABELS.closeControl,
    tpm: 80,
    cues: ["Roll across defender momentum", "Drive with the left instep", "Keep the ball attached through exit"],
  },
  {
    id: "alternating-feet-juggling",
    name: "Alternating Feet Juggling",
    category: "Ball Mastery",
    level: "Intermediate",
    dose: "5 min",
    equipment: "Ball",
    metric: "touches",
    source: SOURCE_LABELS.advancedTouch,
    tpm: 100,
    cues: ["Lock the ankle", "Strike with the laces", "Stay balanced between contacts"],
  },
  {
    id: "thigh-foot-juggling",
    name: "Thigh-Foot Juggling Combo",
    category: "Ball Mastery",
    level: "Intermediate",
    dose: "5 min",
    equipment: "Ball",
    metric: "touches",
    source: SOURCE_LABELS.advancedTouch,
    tpm: 80,
    cues: ["Cushion the thigh drop", "Set the next foot touch", "Keep the ball below chest height"],
  },
  {
    id: "one-touch-wall",
    name: "1-Touch Wall Passing",
    category: "Ball Mastery",
    level: "All Levels",
    dose: "5 min",
    equipment: "Wall and ball",
    metric: "touches",
    source: SOURCE_LABELS.advancedTouch,
    tpm: 60,
    cues: ["Strike firmly with the inside foot", "Keep toes pointed up", "Alternate right and left"],
  },
  {
    id: "two-touch-wall",
    name: "2-Touch Wall Receive Across Body",
    category: "Ball Mastery",
    level: "Intermediate",
    dose: "5 min",
    equipment: "Wall and ball",
    metric: "touches",
    source: SOURCE_LABELS.advancedTouch,
    tpm: 40,
    cues: ["Receive across the body", "Use the back foot", "Pass with the opposite foot"],
  },
  {
    id: "linear-cone-weave",
    name: "Linear Cone Weave",
    category: "Ball Mastery",
    level: "Intermediate",
    dose: "4 min",
    equipment: "Cones and ball",
    metric: "touches",
    source: SOURCE_LABELS.advancedTouch,
    tpm: 90,
    cues: ["Keep the head up", "Use inside and outside surfaces", "Accelerate out of the last cone"],
  },
  {
    id: "hill-repeats",
    name: "Hill Repeats",
    category: "Recovery",
    level: "Intermediate",
    dose: "6 x 20-30 m",
    equipment: "Hill",
    metric: "time",
    source: SOURCE_LABELS.drills,
    cues: ["Power uphill", "Walk back recovery", "Use only if mechanics stay clean"],
  },
  {
    id: "tempo-100",
    name: "Tempo Run 100m",
    category: "Recovery",
    level: "Low",
    dose: "6 x 100 m at 70%",
    equipment: "Track or field",
    metric: "time",
    source: SOURCE_LABELS.workbook,
    cues: ["Flush CNS", "Relaxed rhythm", "Stop before it becomes a sprint workout"],
  },
  {
    id: "tempo-ladder",
    name: "Tempo Run Ladder",
    category: "Recovery",
    level: "Low",
    dose: "2x400, 3x300, 4x200, or 6x100 at 70%",
    equipment: "Track or field",
    metric: "time",
    source: SOURCE_LABELS.workbook,
    cues: ["Pick one option", "Keep every rep smooth", "Nasal-breathing pace is fine"],
  },
  {
    id: "jump-rope-flow",
    name: "Jump Rope Flow",
    category: "Recovery",
    level: "Low",
    dose: "5 to 12 min",
    equipment: "Jump rope",
    metric: "minutes",
    source: SOURCE_LABELS.workbook,
    cues: ["Light contacts", "Stay relaxed", "Use as warm-up or recovery"],
  },
];

const WEEKLY_PLAN = [
  {
    day: "Monday",
    focus: "Cardio + cone rhythm",
    intent: "Build repeatable footwork and aerobic support without heavy CNS cost.",
    meters: 0,
    contacts: 80,
    blocks: [
      { name: "Easy cardio", dose: "30 min", category: "Recovery" },
      { name: "X Drill", dose: "15 min", category: "Agility", drillId: "x-drill" },
      { name: "V Drill", dose: "15 min", category: "Agility", drillId: "v-drill" },
    ],
  },
  {
    day: "Tuesday",
    focus: "Hill, plyo, and sprint exposure",
    intent: "Blend hill power with low-to-moderate plyometric contacts.",
    meters: 180,
    contacts: 120,
    blocks: [
      { name: "Hill work", dose: "25 min", category: "Recovery", drillId: "hill-repeats" },
      { name: "Right-leg plyo jumps", dose: "controlled block", category: "Plyometrics" },
      { name: "Left-leg plyo jumps", dose: "controlled block", category: "Plyometrics" },
      { name: "Both-leg plyo jumps", dose: "controlled block", category: "Plyometrics" },
      { name: "Sprint finish", dose: "short fast reps", category: "Acceleration" },
    ],
  },
  {
    day: "Wednesday",
    focus: "Ball mastery + mobility",
    intent: "Touch quality, ankles, hips, and low fatigue field feel.",
    meters: 0,
    contacts: 60,
    blocks: [
      { name: "Figure-8 dribbling", dose: "3 x 45 sec", category: "Ball Mastery", drillId: "figure-8" },
      { name: "V Cut series", dose: "3x each foot", category: "Ball Mastery", drillId: "v-cut" },
      { name: "Jump rope flow", dose: "5 to 8 min", category: "Recovery", drillId: "jump-rope-flow" },
    ],
  },
  {
    day: "Thursday",
    focus: "Recovery or off",
    intent: "Restore tissue quality before the high-speed Friday session.",
    meters: 0,
    contacts: 0,
    blocks: [
      { name: "Walk, bike, or mobility", dose: "20 to 30 min easy", category: "Recovery" },
      { name: "Optional ball touches", dose: "10 min relaxed", category: "Ball Mastery" },
    ],
  },
  {
    day: "Friday",
    focus: "Sprint mechanics + first-step explosion",
    intent: "Highest quality acceleration day. Full rest, stop before sloppy reps.",
    meters: 190,
    contacts: 70,
    blocks: [
      { name: "A-Skips -> A-Runs -> Bounds", dose: "3 x 20 m progression", category: "Max Velocity", drillId: "a-skip" },
      { name: "Falling Start to Sprint", dose: "4 x 10 m, 3 x 20 m", category: "Acceleration", drillId: "falling-start" },
      { name: "Sprint Sled Pulls", dose: "5 x 10 m at 15-25% BW", category: "Acceleration", drillId: "sled-pull" },
      { name: "Wall Drill Series", dose: "3 x 10 each leg", category: "Acceleration", drillId: "wall-drill" },
      { name: "Ankling + dribble run ladder", dose: "4 sets into 20 m sprint", category: "Acceleration" },
    ],
  },
  {
    day: "Saturday",
    focus: "Reactive agility or light play",
    intent: "Apply movement skill with a reaction component, but keep total fatigue honest.",
    meters: 120,
    contacts: 60,
    blocks: [
      { name: "Mirror Drill", dose: "4 x 20 sec", category: "Agility", drillId: "mirror-drill" },
      { name: "5-10-5 Shuttle", dose: "4 timed reps", category: "Agility", drillId: "five-ten-five" },
      { name: "La Croqueta Series", dose: "3x each pattern", category: "Ball Mastery", drillId: "la-croqueta" },
    ],
  },
  {
    day: "Sunday",
    focus: "Recovery + flow + sprint mechanics",
    intent: "Tempo rhythm, touch flow, and easy mechanics cleanup.",
    meters: 1200,
    contacts: 60,
    blocks: [
      { name: "Jump Rope Flow", dose: "5 to 12 min", category: "Recovery", drillId: "jump-rope-flow" },
      { name: "Tempo run option", dose: "2x400, 3x300, 4x200, or 6x100 at 70%", category: "Recovery", drillId: "tempo-ladder" },
      { name: "A-Skip mechanics", dose: "2 x 20 m relaxed", category: "Max Velocity", drillId: "a-skip" },
    ],
  },
];

const DEFAULT_ATHLETES = [
  { id: "ath-jayden", name: "Jayden", email: "", group: "Attackers", status: "Active", notes: "First-step and close-control focus" },
  { id: "ath-mia", name: "Mia", email: "", group: "Midfield", status: "Active", notes: "Tempo, scanning, wall work" },
  { id: "ath-noah", name: "Noah", email: "", group: "Defenders", status: "Active", notes: "Lateral agility and recovery runs" },
];

const DEFAULT_PROGRAMS = [
  {
    id: "prog-first-step",
    name: "First-Step Explosion",
    focus: "Acceleration",
    notes: "High-quality sprint mechanics, full rest, clean first three steps.",
    drills: ["wall-drill", "falling-start", "sled-pull", "two-point-10"],
  },
  {
    id: "prog-close-control",
    name: "Close-Control Touch Block",
    focus: "Ball Mastery",
    notes: "Built from the attached close-control and technical-touch trackers.",
    drills: ["right-foot-only-close", "left-foot-only-close", "inside-pendulum", "croquetas-lr", "ball-rolls-lr"],
  },
  {
    id: "prog-agility-react",
    name: "Reactive Agility Group",
    focus: "Agility",
    notes: "Change of direction with a reaction component for small groups.",
    drills: ["mirror-drill", "short-lateral-shuttle", "five-ten-five", "skater-jumps"],
  },
];

const DEFAULT_CALENDAR_EVENTS = [
  {
    id: "event-demo",
    date: new Date().toISOString().slice(0, 10),
    time: "17:30",
    title: "Squad Speed + Touch Session",
    programId: "prog-close-control",
    targetType: "squad",
    targetId: "squad",
    location: "Main field",
    notes: "Bring ball, water, cleats, and flats.",
  },
];

const BENCHMARKS = [
  { id: "ten-yard", name: "10 Yard Start", category: "Acceleration", unit: "sec", lowerBetter: true, source: SOURCE_LABELS.overtime },
  { id: "flying-sprint", name: "Flying Sprint", category: "Max Velocity", unit: "sec", lowerBetter: true, source: SOURCE_LABELS.workbook },
  { id: "five-ten-five-test", name: "5-10-5 Shuttle", category: "Agility", unit: "sec", lowerBetter: true, source: SOURCE_LABELS.drills },
  { id: "lateral-shuttle-test", name: "Short Lateral Shuttle", category: "Agility", unit: "sec", lowerBetter: true, source: SOURCE_LABELS.overtime },
  { id: "standing-broad", name: "Standing Broad Jump", category: "Plyometrics", unit: "in", lowerBetter: false, source: SOURCE_LABELS.plylo },
  { id: "standing-triple-test", name: "Standing Triple Jump", category: "Plyometrics", unit: "ft", lowerBetter: false, source: SOURCE_LABELS.scanned },
  { id: "vertical-jump", name: "Vertical Jump", category: "Plyometrics", unit: "in", lowerBetter: false, source: SOURCE_LABELS.plyoDoc },
  { id: "tempo-100-test", name: "Tempo 100m Average", category: "Recovery", unit: "sec", lowerBetter: true, source: SOURCE_LABELS.workbook },
  { id: "stanford-fitness", name: "Stanford Soccer Fitness", category: "Recovery", unit: "score", lowerBetter: false, source: SOURCE_LABELS.stanford },
];

const TABS = [
  { key: "today", label: "Today" },
  { key: "team", label: "Team" },
  { key: "program", label: "Programs" },
  { key: "calendar", label: "Calendar" },
  { key: "email", label: "Email" },
  { key: "drills", label: "Drills" },
  { key: "log", label: "Log" },
  { key: "tests", label: "Tests" },
  { key: "trends", label: "Trends" },
];

const STORAGE_KEY = "speeddesk:v1";

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);
const num = (value) => Number(value) || 0;
const compactDate = (date) => (date || "").slice(5);

function currentDayName() {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

function recentCut(days) {
  return new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
}

function weekKey(date) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

function bestTestFor(testId, testLog) {
  const benchmark = BENCHMARKS.find((x) => x.id === testId);
  const rows = testLog.filter((x) => x.testId === testId);
  if (!benchmark || rows.length === 0) return null;
  return rows.reduce((best, row) => {
    if (!best) return row;
    return benchmark.lowerBetter ? (row.score < best.score ? row : best) : (row.score > best.score ? row : best);
  }, null);
}

function estimateSession(dayName, readiness) {
  const base = WEEKLY_PLAN.find((x) => x.day === dayName) || WEEKLY_PLAN[0];
  const modifier = readiness <= 2 ? 0.65 : readiness >= 5 ? 1.1 : 1;
  return {
    meters: Math.round(base.meters * modifier),
    contacts: Math.round(base.contacts * modifier),
  };
}

function sourceCount(log, days = 7) {
  const cut = recentCut(days);
  return log.filter((x) => x.date >= cut).length;
}

function drillName(id) {
  return DRILLS.find((drill) => drill.id === id)?.name || "Unknown drill";
}

function getProgram(programs, programId) {
  return programs.find((program) => program.id === programId) || programs[0];
}

function getProgramDrills(program) {
  if (!program) return [];
  return (program.drills || []).map((id) => DRILLS.find((drill) => drill.id === id)).filter(Boolean);
}

function estimateProgramMinutes(program) {
  const count = (program?.drills || []).length;
  return Math.max(20, count * 6);
}

function groupsFromAthletes(athletes) {
  return Array.from(new Set(athletes.map((athlete) => athlete.group).filter(Boolean))).sort();
}

function eventRecipientAthletes(event, athletes) {
  if (!event) return [];
  if (event.targetType === "athlete") return athletes.filter((athlete) => athlete.id === event.targetId);
  if (event.targetType === "group") return athletes.filter((athlete) => athlete.group === event.targetId);
  return athletes.filter((athlete) => athlete.status !== "Inactive");
}

function eventTargetLabel(event, athletes) {
  if (!event) return "No target";
  if (event.targetType === "athlete") return athletes.find((athlete) => athlete.id === event.targetId)?.name || "Athlete";
  if (event.targetType === "group") return event.targetId || "Group";
  return "Whole squad";
}

function buildSessionEmail(event, programs, athletes) {
  const program = getProgram(programs, event?.programId);
  const drillLines = getProgramDrills(program).map((drill, index) => `${index + 1}. ${drill.name} - ${drill.dose}`);
  const recipients = eventRecipientAthletes(event, athletes).filter((athlete) => athlete.email);
  const subject = `${event?.title || "Training session"} - ${event?.date || ""}`;
  const body = [
    `Session: ${event?.title || "Training session"}`,
    `Date/time: ${event?.date || "TBD"} ${event?.time || ""}`.trim(),
    `Location: ${event?.location || "TBD"}`,
    `Group: ${eventTargetLabel(event, athletes)}`,
    "",
    `Program: ${program?.name || "No program selected"}`,
    program?.notes ? `Focus: ${program.notes}` : "",
    "",
    "Workout:",
    ...(drillLines.length ? drillLines : ["No drills selected yet."]),
    "",
    event?.notes ? `Notes: ${event.notes}` : "",
  ].filter((line) => line !== "").join("\n");
  const mailto = `mailto:${recipients.map((athlete) => athlete.email).join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { subject, body, recipients, mailto };
}

export default function SpeedDesk() {
  const [tab, setTab] = useState("today");
  const [selectedDay, setSelectedDay] = useState(currentDayName());
  const [readiness, setReadiness] = useState(4);
  const [drillQuery, setDrillQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [favorites, setFavorites] = useState([]);
  const [athletes, setAthletes] = useState(DEFAULT_ATHLETES);
  const [programs, setPrograms] = useState(DEFAULT_PROGRAMS);
  const [calendarEvents, setCalendarEvents] = useState(DEFAULT_CALENDAR_EVENTS);
  const [sessionLog, setSessionLog] = useState([]);
  const [speedLog, setSpeedLog] = useState([]);
  const [testLog, setTestLog] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const record = await window.storage.get(STORAGE_KEY);
        if (record?.value) {
          const saved = JSON.parse(record.value);
          setFavorites(saved.favorites || []);
          setAthletes(saved.athletes?.length ? saved.athletes : DEFAULT_ATHLETES);
          setPrograms(saved.programs?.length ? saved.programs : DEFAULT_PROGRAMS);
          setCalendarEvents(saved.calendarEvents?.length ? saved.calendarEvents : DEFAULT_CALENDAR_EVENTS);
          setSessionLog(saved.sessionLog || []);
          setSpeedLog(saved.speedLog || []);
          setTestLog(saved.testLog || []);
          if (saved.selectedDay) setSelectedDay(saved.selectedDay);
          if (saved.readiness) setReadiness(saved.readiness);
        }
      } catch (error) {
        // Local storage can fail in private browser modes. The app still works for the session.
      }
      setLoaded(true);
    })();
  }, []);

  const persist = async (note = "Saved") => {
    try {
      await window.storage.set(
        STORAGE_KEY,
        JSON.stringify({
          favorites,
          athletes,
          programs,
          calendarEvents,
          sessionLog,
          speedLog,
          testLog,
          selectedDay,
          readiness,
        })
      );
      setFlash(note);
      setTimeout(() => setFlash(""), 1500);
    } catch (error) {
      setFlash("Local save failed");
      setTimeout(() => setFlash(""), 1800);
    }
  };

  useEffect(() => {
    if (loaded) persist("Saved");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites, athletes, programs, calendarEvents, sessionLog, speedLog, testLog, selectedDay, readiness]);

  const toggleFavorite = (id) => {
    setFavorites((current) => (current.includes(id) ? current.filter((x) => x !== id) : [id, ...current]));
  };

  const exportData = () => {
    const data = {
      favorites,
      athletes,
      programs,
      calendarEvents,
      sessionLog,
      speedLog,
      testLog,
      selectedDay,
      readiness,
      _app: "SpeedDesk",
      _exported: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `speeddesk-backup-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setFlash("Exported");
    setTimeout(() => setFlash(""), 1500);
  };

  const importData = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const saved = JSON.parse(reader.result);
        setFavorites(saved.favorites || []);
        setAthletes(saved.athletes?.length ? saved.athletes : DEFAULT_ATHLETES);
        setPrograms(saved.programs?.length ? saved.programs : DEFAULT_PROGRAMS);
        setCalendarEvents(saved.calendarEvents?.length ? saved.calendarEvents : DEFAULT_CALENDAR_EVENTS);
        setSessionLog(saved.sessionLog || []);
        setSpeedLog(saved.speedLog || []);
        setTestLog(saved.testLog || []);
        if (saved.selectedDay) setSelectedDay(saved.selectedDay);
        if (saved.readiness) setReadiness(saved.readiness);
        setFlash("Imported");
        setTimeout(() => setFlash(""), 1600);
      } catch (error) {
        setFlash("Import failed");
        setTimeout(() => setFlash(""), 2000);
      }
    };
    reader.readAsText(file);
  };

  const drillById = useMemo(() => Object.fromEntries(DRILLS.map((x) => [x.id, x])), []);
  const plan = WEEKLY_PLAN.find((x) => x.day === selectedDay) || WEEKLY_PLAN[0];
  const estimate = estimateSession(selectedDay, readiness);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-row">
          <div>
            <div className="brand">SPEED<span>DESK</span></div>
            <div className="tagline">Speed, agility, plyos, ball mastery</div>
          </div>
          {flash && <div className="flash">{flash}</div>}
        </div>
        <nav className="tabs" aria-label="Primary">
          {TABS.map((item) => (
            <button
              key={item.key}
              className={tab === item.key ? "tab active" : "tab"}
              onClick={() => setTab(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="content">
        {tab === "today" && (
          <Today
            plan={plan}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            readiness={readiness}
            setReadiness={setReadiness}
            estimate={estimate}
            sessionLog={sessionLog}
            setSessionLog={setSessionLog}
            drillById={drillById}
            exportData={exportData}
            importData={importData}
          />
        )}
        {tab === "team" && <Team athletes={athletes} setAthletes={setAthletes} />}
        {tab === "program" && <Program drillById={drillById} programs={programs} setPrograms={setPrograms} />}
        {tab === "calendar" && (
          <Calendar
            athletes={athletes}
            programs={programs}
            calendarEvents={calendarEvents}
            setCalendarEvents={setCalendarEvents}
          />
        )}
        {tab === "email" && <EmailCenter athletes={athletes} programs={programs} calendarEvents={calendarEvents} />}
        {tab === "drills" && (
          <Drills
            query={drillQuery}
            setQuery={setDrillQuery}
            category={category}
            setCategory={setCategory}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
          />
        )}
        {tab === "log" && <SpeedLog speedLog={speedLog} setSpeedLog={setSpeedLog} />}
        {tab === "tests" && <Tests testLog={testLog} setTestLog={setTestLog} />}
        {tab === "trends" && <Trends speedLog={speedLog} sessionLog={sessionLog} testLog={testLog} />}
      </main>
    </div>
  );
}

function Today({
  plan,
  selectedDay,
  setSelectedDay,
  readiness,
  setReadiness,
  estimate,
  sessionLog,
  setSessionLog,
  drillById,
  exportData,
  importData,
}) {
  const [notes, setNotes] = useState("");
  const recentSessions = useMemo(() => sessionLog.filter((x) => x.date >= recentCut(7)), [sessionLog]);
  const completedToday = sessionLog.some((x) => x.date === today() && x.day === selectedDay);

  const completeSession = () => {
    setSessionLog([
      {
        id: uid(),
        date: today(),
        day: selectedDay,
        focus: plan.focus,
        readiness,
        meters: estimate.meters,
        contacts: estimate.contacts,
        notes,
      },
      ...sessionLog,
    ]);
    setNotes("");
  };

  return (
    <>
      <Panel title="Today" sub={plan.focus}>
        <div className="day-strip">
          {WEEKLY_PLAN.map((day) => (
            <button
              key={day.day}
              type="button"
              className={selectedDay === day.day ? "chip active" : "chip"}
              onClick={() => setSelectedDay(day.day)}
            >
              {day.day.slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="field-visual" aria-label="Session field visual">
          <div className="lane lane-one" />
          <div className="lane lane-two" />
          <div className="runner-dot" />
          <div className="finish-line" />
        </div>

        <p className="lead">{plan.intent}</p>
        <div className="metric-grid">
          <Metric label="Planned meters" value={estimate.meters} accent="orange" />
          <Metric label="Jump contacts" value={estimate.contacts} accent="gold" />
          <Metric label="Sessions 7d" value={recentSessions.length} accent="green" />
        </div>

        <Field label={`Readiness: ${readiness}/5`}>
          <input
            className="range"
            type="range"
            min="1"
            max="5"
            value={readiness}
            onChange={(event) => setReadiness(Number(event.target.value))}
          />
        </Field>
      </Panel>

      <Panel title="Session Blocks" sub="Source-derived plan for the selected day">
        <div className="block-list">
          {plan.blocks.map((block, index) => (
            <div className="block-item" key={`${block.name}-${index}`}>
              <div className="block-main">
                <Badge category={block.category} />
                <div>
                  <div className="item-title">{block.name}</div>
                  <div className="muted">{block.dose}</div>
                </div>
              </div>
              {block.drillId && drillById[block.drillId] && (
                <div className="cue-line">{drillById[block.drillId].cues[0]}</div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Complete Session" sub={completedToday ? "A session for this day is already logged today" : "Save today's volume and readiness"}>
        <textarea
          className="text-area"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notes: surface, soreness, best rep, change of direction quality"
        />
        <SaveBtn onClick={completeSession} label={completedToday ? "Log Another Session" : "Mark Session Complete"} />
      </Panel>

      <Panel title="Backup" sub="Portable local data">
        <div className="button-row">
          <button className="ghost-btn gold" type="button" onClick={exportData}>
            Export JSON
          </button>
          <label className="ghost-btn">
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                importData(event.target.files[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </Panel>
    </>
  );
}

function Team({ athletes, setAthletes }) {
  const [athlete, setAthlete] = useState({ name: "", email: "", group: "Attackers", status: "Active", notes: "" });
  const groups = groupsFromAthletes(athletes);

  const addAthlete = () => {
    if (!athlete.name.trim()) return;
    setAthletes([{ id: uid(), ...athlete, name: athlete.name.trim(), email: athlete.email.trim() }, ...athletes]);
    setAthlete({ name: "", email: "", group: athlete.group || "Attackers", status: "Active", notes: "" });
  };

  const updateAthlete = (id, field, value) => {
    setAthletes(athletes.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const deleteAthlete = (id) => {
    setAthletes(athletes.filter((item) => item.id !== id));
  };

  return (
    <>
      <Panel title="Players" sub="Manage athlete emails, groups, status, and session notes">
        <div className="form-grid">
          <Field label="Name">
            <input className="input" value={athlete.name} onChange={(event) => setAthlete({ ...athlete, name: event.target.value })} placeholder="Player name" />
          </Field>
          <Field label="Email">
            <input className="input" value={athlete.email} onChange={(event) => setAthlete({ ...athlete, email: event.target.value })} placeholder="player@email.com" />
          </Field>
          <Field label="Group">
            <input className="input" value={athlete.group} onChange={(event) => setAthlete({ ...athlete, group: event.target.value })} placeholder="Attackers" />
          </Field>
          <Field label="Status">
            <select className="input" value={athlete.status} onChange={(event) => setAthlete({ ...athlete, status: event.target.value })}>
              <option>Active</option>
              <option>Injured</option>
              <option>Inactive</option>
            </select>
          </Field>
        </div>
        <textarea
          className="text-area"
          value={athlete.notes}
          onChange={(event) => setAthlete({ ...athlete, notes: event.target.value })}
          placeholder="Development focus, parent contact notes, restrictions"
        />
        <SaveBtn onClick={addAthlete} label="Add Player" />
      </Panel>

      <Panel title="Squad Board" sub={`${athletes.length} players - ${groups.length || 0} groups`}>
        {athletes.length === 0 && <Empty text="Add a player to start building group workouts." />}
        {athletes.map((item) => (
          <div className="coach-card" key={item.id}>
            <div className="coach-card-head">
              <div>
                <div className="item-title">{item.name || "Unnamed player"}</div>
                <div className="muted">{item.email || "No email yet"}</div>
              </div>
              <DelBtn onClick={() => deleteAthlete(item.id)} />
            </div>
            <div className="form-grid compact">
              <Field label="Group">
                <input className="input" value={item.group} onChange={(event) => updateAthlete(item.id, "group", event.target.value)} />
              </Field>
              <Field label="Status">
                <select className="input" value={item.status} onChange={(event) => updateAthlete(item.id, "status", event.target.value)}>
                  <option>Active</option>
                  <option>Injured</option>
                  <option>Inactive</option>
                </select>
              </Field>
            </div>
            <textarea
              className="text-area small"
              value={item.notes || ""}
              onChange={(event) => updateAthlete(item.id, "notes", event.target.value)}
              placeholder="Player notes"
            />
          </div>
        ))}
      </Panel>
    </>
  );
}

function Program({ drillById, programs, setPrograms }) {
  const [draft, setDraft] = useState({
    name: "New Group Workout",
    focus: "Ball Mastery",
    notes: "Session objective, coaching points, and constraints.",
    drills: ["right-foot-only-close", "inside-pendulum", "croquetas-lr"],
  });

  const addProgram = () => {
    if (!draft.name.trim()) return;
    setPrograms([{ id: uid(), ...draft, name: draft.name.trim(), drills: draft.drills.filter(Boolean) }, ...programs]);
  };

  const deleteProgram = (id) => {
    setPrograms(programs.filter((program) => program.id !== id));
  };

  const setDrillAt = (index, drillId) => {
    const next = [...draft.drills];
    next[index] = drillId;
    setDraft({ ...draft, drills: next });
  };

  const removeDraftDrill = (index) => {
    setDraft({ ...draft, drills: draft.drills.filter((_, drillIndex) => drillIndex !== index) });
  };

  return (
    <>
      <Panel title="Build Program" sub="Create a reusable training session from library drills">
        <div className="form-grid">
          <Field label="Program name">
            <input className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </Field>
          <Field label="Focus">
            <select className="input" value={draft.focus} onChange={(event) => setDraft({ ...draft, focus: event.target.value })}>
              {CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
        </div>
        <textarea className="text-area" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        <div className="builder-list">
          {draft.drills.map((drillId, index) => (
            <div className="builder-row" key={`${drillId}-${index}`}>
              <select className="input" value={drillId} onChange={(event) => setDrillAt(index, event.target.value)}>
                {DRILLS.map((drill) => (
                  <option key={drill.id} value={drill.id}>{drill.name}</option>
                ))}
              </select>
              <button className="ghost-btn small-btn" type="button" onClick={() => removeDraftDrill(index)}>Remove</button>
            </div>
          ))}
        </div>
        <div className="button-row">
          <button className="ghost-btn" type="button" onClick={() => setDraft({ ...draft, drills: [...draft.drills, DRILLS[0].id] })}>
            Add Drill
          </button>
          <button className="ghost-btn gold" type="button" onClick={addProgram}>
            Save Program
          </button>
        </div>
      </Panel>

      <Panel title="Saved Programs" sub={`${programs.length} reusable workouts`}>
        {programs.map((program) => (
          <div className="coach-card" key={program.id}>
            <div className="coach-card-head">
              <div>
                <div className="item-title">{program.name}</div>
                <div className="muted">{program.focus} - about {estimateProgramMinutes(program)} min</div>
              </div>
              {!program.id.startsWith("prog-") && <DelBtn onClick={() => deleteProgram(program.id)} />}
            </div>
            <p className="muted tight">{program.notes}</p>
            <div className="mini-program-list">
              {getProgramDrills(program).map((drill, index) => (
                <div className="mini-row" key={`${program.id}-${drill.id}-${index}`}>
                  <Badge category={drill.category} />
                  <span>{drill.name}</span>
                  <strong>{drill.dose}</strong>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Panel>

      <Panel title="Weekly Plan" sub="Workbook structure, tightened into a repeatable training week">
        <div className="program-grid">
          {WEEKLY_PLAN.map((day) => (
            <div className="program-day" key={day.day}>
              <div className="program-head">
                <div>
                  <div className="day-name">{day.day}</div>
                  <div className="item-title">{day.focus}</div>
                </div>
                <div className="mini-stack">
                  <span>{day.meters} m</span>
                  <span>{day.contacts} contacts</span>
                </div>
              </div>
              <p className="muted tight">{day.intent}</p>
              {day.blocks.map((block, index) => (
                <div className="mini-row" key={`${day.day}-${block.name}-${index}`}>
                  <Badge category={block.category} />
                  <span>{block.name}</span>
                  <strong>{block.dose}</strong>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Progression Rules" sub="The spine of the speed-folder notes">
        <div className="rule-list">
          <Rule n="1" text="Treat acceleration, max velocity, agility, plyometrics, and recovery as separate qualities." />
          <Rule n="2" text="High CNS work goes early in the session and early enough in the week to recover." />
          <Rule n="3" text="Full rest beats tired volume for timed starts, fly-ins, and depth jump combinations." />
          <Rule n="4" text="Progress cone spacing, box height, load, or total reps one variable at a time." />
          <Rule n="5" text="If deceleration control drops below 3/5, cut the rep or switch to recovery tempo." />
        </div>
      </Panel>

      <Panel title="Progression Table" sub="Imported from the workbook's Drill Progression tab">
        {["a-skip", "mirror-drill", "fly-in", "sprint-stop-sprint", "depth-jump-sprint", "tempo-100"].map((id) => {
          const drill = drillById[id];
          return (
            <div className="progress-row" key={id}>
              <Badge category={drill.category} />
              <div>
                <div className="item-title">{drill.name}</div>
                <div className="muted">{drill.level} - {drill.cues[0]}</div>
              </div>
            </div>
          );
        })}
      </Panel>
    </>
  );
}

function Calendar({ athletes, programs, calendarEvents, setCalendarEvents }) {
  const groups = groupsFromAthletes(athletes);
  const [event, setEvent] = useState({
    date: today(),
    time: "17:30",
    title: "Training Session",
    programId: programs[0]?.id || "",
    targetType: "squad",
    targetId: "squad",
    location: "Main field",
    notes: "",
  });

  const targetOptions = event.targetType === "athlete" ? athletes : groups.map((group) => ({ id: group, name: group }));

  const addEvent = () => {
    if (!event.title.trim()) return;
    setCalendarEvents([{ id: uid(), ...event, title: event.title.trim() }, ...calendarEvents]);
  };

  const deleteEvent = (id) => {
    setCalendarEvents(calendarEvents.filter((item) => item.id !== id));
  };

  return (
    <>
      <Panel title="Schedule Workout" sub="Assign a program to one player, a group, or the whole squad">
        <div className="form-grid">
          <Field label="Date">
            <input className="input" type="date" value={event.date} onChange={(change) => setEvent({ ...event, date: change.target.value })} />
          </Field>
          <Field label="Time">
            <input className="input" type="time" value={event.time} onChange={(change) => setEvent({ ...event, time: change.target.value })} />
          </Field>
          <Field label="Title">
            <input className="input" value={event.title} onChange={(change) => setEvent({ ...event, title: change.target.value })} />
          </Field>
          <Field label="Location">
            <input className="input" value={event.location} onChange={(change) => setEvent({ ...event, location: change.target.value })} />
          </Field>
          <Field label="Program">
            <select className="input" value={event.programId} onChange={(change) => setEvent({ ...event, programId: change.target.value })}>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>{program.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Send to">
            <select
              className="input"
              value={event.targetType}
              onChange={(change) => setEvent({ ...event, targetType: change.target.value, targetId: change.target.value === "squad" ? "squad" : "" })}
            >
              <option value="squad">Whole squad</option>
              <option value="group">Group</option>
              <option value="athlete">Player</option>
            </select>
          </Field>
          {event.targetType !== "squad" && (
            <Field label={event.targetType === "athlete" ? "Player" : "Group"}>
              <select className="input" value={event.targetId} onChange={(change) => setEvent({ ...event, targetId: change.target.value })}>
                <option value="">Choose...</option>
                {targetOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <textarea className="text-area" value={event.notes} onChange={(change) => setEvent({ ...event, notes: change.target.value })} placeholder="Arrival notes, equipment, field number" />
        <SaveBtn onClick={addEvent} label="Schedule Session" />
      </Panel>

      <Panel title="Calendar" sub={`${calendarEvents.length} scheduled sessions`}>
        {calendarEvents.length === 0 && <Empty text="Schedule a program to build the team calendar." />}
        {calendarEvents.map((item) => {
          const program = getProgram(programs, item.programId);
          return (
            <div className="coach-card" key={item.id}>
              <div className="coach-card-head">
                <div>
                  <div className="item-title">{item.title}</div>
                  <div className="muted">{item.date} {item.time} - {item.location}</div>
                </div>
                <DelBtn onClick={() => deleteEvent(item.id)} />
              </div>
              <div className="detail-row">
                <span>{program?.name || "No program"}</span>
                <span>{eventTargetLabel(item, athletes)}</span>
                <span>{eventRecipientAthletes(item, athletes).filter((athlete) => athlete.email).length} emails</span>
              </div>
              {item.notes && <div className="cue-line">{item.notes}</div>}
            </div>
          );
        })}
      </Panel>
    </>
  );
}

function EmailCenter({ athletes, programs, calendarEvents }) {
  const [eventId, setEventId] = useState(calendarEvents[0]?.id || "");
  const selected = calendarEvents.find((event) => event.id === eventId) || calendarEvents[0];
  const email = selected ? buildSessionEmail(selected, programs, athletes) : null;

  return (
    <>
      <Panel title="Session Email" sub="Generate a workout email from your calendar">
        {calendarEvents.length === 0 ? (
          <Empty text="Schedule a session first, then email it from here." />
        ) : (
          <>
            <Field label="Scheduled session">
              <select className="input" value={selected?.id || ""} onChange={(event) => setEventId(event.target.value)}>
                {calendarEvents.map((item) => (
                  <option key={item.id} value={item.id}>{item.date} - {item.title}</option>
                ))}
              </select>
            </Field>
            <div className="metric-grid">
              <Metric label="Recipients" value={email.recipients.length} accent="green" />
              <Metric label="Drills" value={getProgramDrills(getProgram(programs, selected.programId)).length} accent="orange" />
              <Metric label="Minutes" value={estimateProgramMinutes(getProgram(programs, selected.programId))} accent="gold" />
            </div>
            {email.recipients.length === 0 && <div className="callout">Add player emails in Team before sending.</div>}
            <Field label="Subject">
              <input className="input" value={email.subject} readOnly />
            </Field>
            <Field label="Email body">
              <textarea className="text-area email-body" value={email.body} readOnly />
            </Field>
            <a className="save-btn link-btn" href={email.mailto}>Open Email Draft</a>
          </>
        )}
      </Panel>
    </>
  );
}

function Drills({ query, setQuery, category, setCategory, favorites, toggleFavorite }) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DRILLS.filter((drill) => {
      const matchesCategory = category === "All" || drill.category === category || (category === "Favorites" && favorites.includes(drill.id));
      const haystack = `${drill.name} ${drill.category} ${drill.level} ${drill.dose} ${drill.cues.join(" ")}`.toLowerCase();
      return matchesCategory && (!q || haystack.includes(q));
    });
  }, [category, favorites, query]);

  return (
    <>
      <Panel title="Drill Library" sub={`${filtered.length} visible of ${DRILLS.length} source-backed drills`}>
        <div className="control-grid">
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search drill, cue, dose"
          />
          <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>All</option>
            <option>Favorites</option>
            {CATEGORIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
      </Panel>

      <div className="drill-grid">
        {filtered.map((drill) => (
          <article className="drill-card" key={drill.id}>
            <div className="card-top">
              <Badge category={drill.category} />
              <button className={favorites.includes(drill.id) ? "star active" : "star"} type="button" onClick={() => toggleFavorite(drill.id)}>
                {favorites.includes(drill.id) ? "Saved" : "Save"}
              </button>
            </div>
            <h3>{drill.name}</h3>
            <div className="detail-row">
              <span>{drill.level}</span>
              <span>{drill.dose}</span>
            </div>
            <div className="muted">Equipment: {drill.equipment}</div>
            <ul className="cue-list">
              {drill.cues.map((cue) => (
                <li key={cue}>{cue}</li>
              ))}
            </ul>
            <div className="source-line">{drill.source}</div>
          </article>
        ))}
      </div>
    </>
  );
}

function SpeedLog({ speedLog, setSpeedLog }) {
  const [entry, setEntry] = useState({
    date: today(),
    drillId: "two-point-10",
    distance: 10,
    time: "",
    reaction: "",
    decel: 4,
    rpe: 7,
    notes: "",
  });

  const selected = DRILLS.find((x) => x.id === entry.drillId) || DRILLS[0];

  const add = () => {
    setSpeedLog([
      {
        id: uid(),
        ...entry,
        drillName: selected.name,
        category: selected.category,
        distance: num(entry.distance),
        time: entry.time === "" ? null : num(entry.time),
        reaction: entry.reaction === "" ? null : num(entry.reaction),
        decel: num(entry.decel),
        rpe: num(entry.rpe),
      },
      ...speedLog,
    ]);
  };

  const del = (id) => setSpeedLog(speedLog.filter((x) => x.id !== id));

  const bestForDrill = useMemo(() => {
    const timed = speedLog.filter((x) => x.drillId === entry.drillId && x.time);
    if (timed.length === 0) return null;
    return timed.reduce((best, row) => (row.time < best.time ? row : best), timed[0]);
  }, [entry.drillId, speedLog]);

  return (
    <>
      <Panel title="Tracking Sheet" sub="Mirrors the workbook columns: date, drill, distance, time, reaction, decel, notes">
        <div className="form-grid">
          <Field label="Date">
            <input className="input" type="date" value={entry.date} onChange={(event) => setEntry({ ...entry, date: event.target.value })} />
          </Field>
          <Field label="Drill">
            <select className="input" value={entry.drillId} onChange={(event) => setEntry({ ...entry, drillId: event.target.value })}>
              {DRILLS.map((drill) => (
                <option key={drill.id} value={drill.id}>{drill.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Distance (m)">
            <NumIn value={entry.distance} onChange={(value) => setEntry({ ...entry, distance: value })} />
          </Field>
          <Field label="Time (s)">
            <NumIn value={entry.time} onChange={(value) => setEntry({ ...entry, time: value })} step="0.01" />
          </Field>
          <Field label="Reaction (s)">
            <NumIn value={entry.reaction} onChange={(value) => setEntry({ ...entry, reaction: value })} step="0.01" />
          </Field>
          <Field label="Decel 1-5">
            <NumIn value={entry.decel} onChange={(value) => setEntry({ ...entry, decel: value })} min="1" max="5" />
          </Field>
          <Field label="RPE">
            <NumIn value={entry.rpe} onChange={(value) => setEntry({ ...entry, rpe: value })} min="1" max="10" />
          </Field>
        </div>
        <textarea
          className="text-area"
          value={entry.notes}
          onChange={(event) => setEntry({ ...entry, notes: event.target.value })}
          placeholder="Surface, footwear, start type, best cue"
        />
        {bestForDrill && (
          <div className="callout">Best saved {selected.name}: {bestForDrill.time.toFixed(2)}s on {bestForDrill.date}</div>
        )}
        <SaveBtn onClick={add} label="Add Speed Entry" />
      </Panel>

      <Panel title="History" sub={`${speedLog.length} entries`}>
        {speedLog.length === 0 && <Empty text="No timed or quality entries yet." />}
        {speedLog.map((row) => (
          <HistoryRow key={row.id} row={row} onDelete={() => del(row.id)} />
        ))}
      </Panel>
    </>
  );
}

function Tests({ testLog, setTestLog }) {
  const [entry, setEntry] = useState({ date: today(), testId: BENCHMARKS[0].id, score: "", notes: "" });
  const selected = BENCHMARKS.find((x) => x.id === entry.testId) || BENCHMARKS[0];

  const add = () => {
    if (entry.score === "") return;
    setTestLog([{ id: uid(), ...entry, score: num(entry.score), testName: selected.name, unit: selected.unit }, ...testLog]);
  };

  const del = (id) => setTestLog(testLog.filter((x) => x.id !== id));

  return (
    <>
      <Panel title="Benchmarks" sub="Repeat tests under similar conditions">
        <div className="benchmark-grid">
          {BENCHMARKS.map((test) => {
            const best = bestTestFor(test.id, testLog);
            return (
              <button className="benchmark-card" key={test.id} type="button" onClick={() => setEntry({ ...entry, testId: test.id })}>
                <Badge category={test.category} />
                <span>{test.name}</span>
                <strong>{best ? `${best.score} ${test.unit}` : `No ${test.unit}`}</strong>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="Log Test" sub={`${selected.name} - ${selected.lowerBetter ? "lower is better" : "higher is better"}`}>
        <div className="form-grid">
          <Field label="Date">
            <input className="input" type="date" value={entry.date} onChange={(event) => setEntry({ ...entry, date: event.target.value })} />
          </Field>
          <Field label="Test">
            <select className="input" value={entry.testId} onChange={(event) => setEntry({ ...entry, testId: event.target.value })}>
              {BENCHMARKS.map((test) => (
                <option key={test.id} value={test.id}>{test.name}</option>
              ))}
            </select>
          </Field>
          <Field label={`Score (${selected.unit})`}>
            <NumIn value={entry.score} onChange={(value) => setEntry({ ...entry, score: value })} step="0.01" />
          </Field>
        </div>
        <textarea
          className="text-area"
          value={entry.notes}
          onChange={(event) => setEntry({ ...entry, notes: event.target.value })}
          placeholder="Warm-up, weather, surface, shoe, timing method"
        />
        <SaveBtn onClick={add} label="Add Test Result" />
      </Panel>

      <Panel title="Test History" sub={`${testLog.length} entries`}>
        {testLog.length === 0 && <Empty text="No benchmark tests logged yet." />}
        {testLog.map((row) => (
          <div className="history-row" key={row.id}>
            <div className="history-main">
              <Badge category={BENCHMARKS.find((x) => x.id === row.testId)?.category || "Recovery"} />
              <div>
                <div className="item-title">{row.testName}</div>
                <div className="muted">{row.date}{row.notes ? ` - ${row.notes}` : ""}</div>
              </div>
            </div>
            <strong>{row.score} {row.unit}</strong>
            <DelBtn onClick={() => del(row.id)} />
          </div>
        ))}
      </Panel>
    </>
  );
}

function Trends({ speedLog, sessionLog, testLog }) {
  const [drillId, setDrillId] = useState("two-point-10");
  const selected = DRILLS.find((x) => x.id === drillId) || DRILLS[0];
  const timedRows = useMemo(
    () => speedLog.filter((x) => x.drillId === drillId && x.time).sort((a, b) => a.date.localeCompare(b.date)),
    [drillId, speedLog]
  );

  const weeklyVolume = useMemo(() => {
    const byWeek = new Map();
    sessionLog.forEach((row) => {
      const key = weekKey(row.date);
      const current = byWeek.get(key) || { week: key.slice(5), meters: 0, contacts: 0 };
      current.meters += num(row.meters);
      current.contacts += num(row.contacts);
      byWeek.set(key, current);
    });
    return Array.from(byWeek.values()).sort((a, b) => a.week.localeCompare(b.week)).slice(-8);
  }, [sessionLog]);

  const bestTests = useMemo(() => {
    return BENCHMARKS.map((test) => ({ test, best: bestTestFor(test.id, testLog) })).filter((x) => x.best);
  }, [testLog]);

  const meters7 = sessionLog.filter((x) => x.date >= recentCut(7)).reduce((sum, row) => sum + num(row.meters), 0);
  const contacts7 = sessionLog.filter((x) => x.date >= recentCut(7)).reduce((sum, row) => sum + num(row.contacts), 0);

  return (
    <>
      <Panel title="Training Load" sub="Last 7 days">
        <div className="metric-grid">
          <Metric label="Meters" value={meters7} accent="orange" />
          <Metric label="Contacts" value={contacts7} accent="gold" />
          <Metric label="Speed entries" value={sourceCount(speedLog)} accent="green" />
        </div>
      </Panel>

      <Panel title="Timed Drill Trend" sub={selected.name}>
        <select className="input full" value={drillId} onChange={(event) => setDrillId(event.target.value)}>
          {DRILLS.filter((x) => ["time", "reaction"].includes(x.metric)).map((drill) => (
            <option key={drill.id} value={drill.id}>{drill.name}</option>
          ))}
        </select>
        {timedRows.length < 2 ? (
          <Empty text="Log two timed reps of this drill to chart it." />
        ) : (
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timedRows} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="#253128" strokeDasharray="2 4" />
                <XAxis dataKey="date" tick={{ fill: "#7f8a83", fontSize: 10 }} tickFormatter={compactDate} />
                <YAxis
                  tick={{ fill: "#7f8a83", fontSize: 10 }}
                  tickFormatter={(value) => Number(value).toFixed(2)}
                  domain={[
                    (dataMin) => Math.max(0, Math.floor((dataMin - 0.1) * 100) / 100),
                    (dataMax) => Math.ceil((dataMax + 0.1) * 100) / 100,
                  ]}
                />
                <Tooltip contentStyle={{ background: "#121713", border: "1px solid #253128", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="time" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3 }} name="Time" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel title="Weekly Volume" sub="Meters and plyometric contacts from completed sessions">
        {weeklyVolume.length < 2 ? (
          <Empty text="Complete two sessions to see weekly load." />
        ) : (
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyVolume} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="#253128" strokeDasharray="2 4" />
                <XAxis dataKey="week" tick={{ fill: "#7f8a83", fontSize: 10 }} />
                <YAxis tick={{ fill: "#7f8a83", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#121713", border: "1px solid #253128", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="meters" fill="#38bdf8" name="Meters" radius={[4, 4, 0, 0]} />
                <Bar dataKey="contacts" fill="#f6c453" name="Contacts" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel title="Best Tests" sub={`${bestTests.length} benchmarks with results`}>
        {bestTests.length === 0 && <Empty text="Log benchmark tests to fill this board." />}
        {bestTests.map(({ test, best }) => (
          <div className="history-row" key={test.id}>
            <div className="history-main">
              <Badge category={test.category} />
              <div>
                <div className="item-title">{test.name}</div>
                <div className="muted">{best.date} - {test.lowerBetter ? "lower wins" : "higher wins"}</div>
              </div>
            </div>
            <strong>{best.score} {test.unit}</strong>
          </div>
        ))}
      </Panel>
    </>
  );
}

function HistoryRow({ row, onDelete }) {
  return (
    <div className="history-row">
      <div className="history-main">
        <Badge category={row.category} />
        <div>
          <div className="item-title">{row.drillName}</div>
          <div className="muted">
            {row.date} - {row.distance || 0}m
            {row.time ? ` - ${row.time.toFixed(2)}s` : ""}
            {row.reaction ? ` - reaction ${row.reaction.toFixed(2)}s` : ""}
            {row.notes ? ` - ${row.notes}` : ""}
          </div>
        </div>
      </div>
      <div className="score-stack">
        <strong>{row.decel}/5</strong>
        <span>decel</span>
      </div>
      <DelBtn onClick={onDelete} />
    </div>
  );
}

function Rule({ n, text }) {
  return (
    <div className="rule">
      <span>{n}</span>
      <p>{text}</p>
    </div>
  );
}

function Metric({ label, value, accent }) {
  return (
    <div className={`metric ${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Badge({ category }) {
  const color = CATEGORY_COLORS[category] || "#94a3b8";
  return (
    <span className="badge" style={{ "--badge-color": color }}>
      {category}
    </span>
  );
}

function Panel({ title, sub, children }) {
  return (
    <section className="panel">
      <div className="panel-title">{title}</div>
      {sub && <div className="panel-sub">{sub}</div>}
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NumIn({ value, onChange, step = "1", min, max }) {
  return (
    <input
      className="input"
      type="number"
      value={value}
      step={step}
      min={min}
      max={max}
      onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
    />
  );
}

function SaveBtn({ onClick, label }) {
  return (
    <button className="save-btn" type="button" onClick={onClick}>
      {label}
    </button>
  );
}

function DelBtn({ onClick }) {
  return (
    <button className="del-btn" type="button" onClick={onClick} aria-label="Delete entry">
      x
    </button>
  );
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}
