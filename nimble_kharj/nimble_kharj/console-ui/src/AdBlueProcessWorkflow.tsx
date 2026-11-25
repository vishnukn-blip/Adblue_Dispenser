import React, { useState, useEffect, useRef } from "react";

export interface AdBlueProcessWorkflowProps {
  currentStepIndex?: number; // 1 to 11
  activeVehicleNo?: string;
  activeWaybillNo?: string;
  activeDispensedQty?: number;
  activePresetQty?: number;
  onNavigateToReport?: () => void;
  onClose?: () => void;
  isModal?: boolean;
}

interface StepDetail {
  number: number;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  talkingPoint: string;
  technicalNote: string;
}

const ADBLUE_STEPS: StepDetail[] = [
  {
    number: 1,
    title: "Vehicle Arrival",
    subtitle: "Depot Entry & Geofence",
    description: "The vehicle arrives at the designated AdBlue refilling station.",
    icon: "🚛",
    talkingPoint: "The system continuously tracks vehicle GPS telemetry. As soon as the truck enters the 250-meter depot geofence, the station queue arms itself automatically.",
    technicalNote: "NV50 Edge Controller monitors GPS ping latitude/longitude against station geofence radius (250m).",
  },
  {
    number: 2,
    title: "Scan Barcode (at Dispenser)",
    subtitle: "Hardware QR / Barcode Scan",
    description: "The driver comes with Almarai waybill barcode paper and scans it using the scanner on the dispenser.",
    icon: "📸",
    talkingPoint: "The driver presents the official Almarai aTOMS waybill barcode paper to the dispenser's optical scanner. We integrate with SAP's existing barcodes—no custom numbering required.",
    technicalNote: "High-speed 2D barcode scanner decodes Freight Order (FO) string and transmits to edge controller via RS-485.",
  },
  {
    number: 3,
    title: "Vehicle Verification",
    subtitle: "ERP Database Authentication",
    description: "The system automatically verifies the vehicle details against the Almarai database.",
    icon: "🔍",
    talkingPoint: "Within 150 milliseconds, 9 automated rules run in parallel: verifying vehicle registration, waybill validity, authorized station, product match, and remaining quota balance.",
    technicalNote: "9-rule validation engine runs locally on edge cache if cloud link is down; prevents unauthorized vehicle refilling.",
  },
  {
    number: 4,
    title: "Dispenser Authorization",
    subtitle: "PLC Relay & Solenoid Signal",
    description: "Once verified, the system sends an authorization signal to the AdBlue dispenser.",
    icon: "🔒",
    talkingPoint: "Once validated, a secure cryptographic authorization token is minted, and the PLC relay unlatches the physical pump solenoid valve.",
    technicalNote: "Hardware solenoid valve armed with SHA-256 idempotency nonce preventing replay attacks.",
  },
  {
    number: 5,
    title: "Ready for Refilling",
    subtitle: "Solenoid Valve Armed",
    description: "The dispenser screen displays 'Ready for AdBlue Refilling', indicating the system is authorized and ready.",
    icon: "🟢",
    talkingPoint: "The industrial dispenser LCD screen illuminates green with Almarai branding, informing the driver that authorization is confirmed and the nozzle is live.",
    technicalNote: "High-contrast daylight-readable LCD displays preset volume, vehicle ID, and authorization badge.",
  },
  {
    number: 6,
    title: "Nozzle Insertion & Refilling Start",
    subtitle: "Physical Trigger Pressed",
    description: "The driver inserts the AdBlue nozzle into the vehicle's tank and presses the dispenser gun trigger to initiate refilling.",
    icon: "⛽",
    talkingPoint: "The driver unholsters the magnetic nozzle, inserts it into the truck's dedicated AdBlue DEF filler neck, and presses the trigger.",
    technicalNote: "Magnetic holster proximity sensor trips pump motor; optical pulse meter begins tracking rotation.",
  },
  {
    number: 7,
    title: "Automatic AdBlue Dispensing",
    subtitle: "Pulse Meter & Flow Control",
    description: "AdBlue is dispensed into the vehicle. The system continuously monitors the process and automatically stops the flow once the preset quantity or required level is reached.",
    icon: "💧",
    talkingPoint: "High-precision flow meters monitor AdBlue delivery at 38–45 Litres/minute. The system automatically cuts off dispensing the moment the preset waybill entitlement is met.",
    technicalNote: "Dual-channel pulse encoder measures flow at ±0.2% accuracy complying with ISO 22241 standard.",
  },
  {
    number: 8,
    title: "Nozzle Return",
    subtitle: "Holster Microswitch Engaged",
    description: "After refilling is completed, the driver returns the nozzle securely to the dispenser holder.",
    icon: "🔄",
    talkingPoint: "Once refilling halts, the driver stows the nozzle securely. The holster sensor immediately locks the pump solenoid to prevent any unauthorized siphoning.",
    technicalNote: "Microswitch engagement triggers latch lockdown, terminates flow telemetry loop, and initiates transaction closing.",
  },
  {
    number: 9,
    title: "Transaction Recording",
    subtitle: "Local Audit & Nonce Minting",
    description: "The system automatically records all relevant transaction details.",
    icon: "📝",
    talkingPoint: "An immutable audit record is created locally containing Vehicle No, Waybill No, exact Litres dispensed, dispenser totalizer reading, and timestamps.",
    technicalNote: "Local SQLite transaction stored under row-lock with SHA-256 checksum for offline dispute resolution.",
  },
  {
    number: 10,
    title: "Cloud Data Transfer",
    subtitle: "SAP Outbox & IoT Telemetry",
    description: "The transaction data is automatically transmitted to the cloud platform for real-time monitoring, reporting, analytics, inventory tracking, and operational management.",
    icon: "☁️",
    talkingPoint: "The transaction is posted to the central SAP Outbox. Even if internet connectivity is intermittent, transactions buffer locally and replay seamlessly upon reconnection.",
    technicalNote: "MQTT/HTTPS dual-channel telemetry pushes to SAP ERP; updates live inventory and fleet ledgers.",
  },
  {
    number: 11,
    title: "System Ready & Next Vehicle",
    subtitle: "Zero-Downtime Loop Reset",
    description: "Once the transaction is successfully completed, the system resets and becomes ready for the next vehicle. Cycle repeats.",
    icon: "✅",
    talkingPoint: "The dispenser screen clears, totalizers synchronize, and Bay 1 is instantly armed for the next approaching Almarai truck. Operations never stall.",
    technicalNote: "Station state machine cycles from COMPLETED to IDLE in under 500ms; ready for immediate barcode scan.",
  },
];

export const AdBlueProcessWorkflow: React.FC<AdBlueProcessWorkflowProps> = ({
  currentStepIndex = 1,
  activeVehicleNo = "ALM-TRK-1041",
  activeWaybillNo = "6101015888",
  activeDispensedQty = 60.0,
  activePresetQty = 60.0,
  onNavigateToReport,
  onClose,
  isModal = false,
}) => {
  const [activeStep, setActiveStep] = useState<number>(currentStepIndex);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<"normal" | "fast">("normal");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showPitchGuide, setShowPitchGuide] = useState<boolean>(true);

  // Live Interactive simulation states inside hero stage
  const [simDispenseL, setSimDispenseL] = useState<number>(0);
  const [simFlowRate, setSimFlowRate] = useState<number>(0);
  const [simIsFlowing, setSimIsFlowing] = useState<boolean>(false);
  const [laserPulsing, setLaserPulsing] = useState<boolean>(false);
  const [verifyPassedCount, setVerifyPassedCount] = useState<number>(4);
  const [solenoidArmed, setSolenoidArmed] = useState<boolean>(false);
  const [currentDateFormatted, setCurrentDateFormatted] = useState<string>("");

  const flowTimerRef = useRef<any>(null);

  useEffect(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    setCurrentDateFormatted(`${dateStr}, ${timeStr}`);
  }, []);

  // Web Audio Synthetic Sound Effects
  const playSound = (type: "scan" | "click" | "flow" | "done") => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (type === "scan") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === "click") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === "done") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // Audio fallback
    }
  };

  // Step change side effects
  useEffect(() => {
    if (activeStep === 2) {
      setLaserPulsing(true);
      playSound("scan");
    } else {
      setLaserPulsing(false);
    }

    if (activeStep === 4) {
      setSolenoidArmed(true);
      playSound("click");
    }

    if (activeStep === 7) {
      // Start flow simulation
      setSimIsFlowing(true);
      setSimFlowRate(38.6);
      let curr = 0;
      if (flowTimerRef.current) clearInterval(flowTimerRef.current);
      flowTimerRef.current = setInterval(() => {
        curr += 4.5;
        if (curr >= activePresetQty) {
          curr = activePresetQty;
          clearInterval(flowTimerRef.current);
          setSimIsFlowing(false);
          setSimFlowRate(0);
          setSimDispenseL(curr);
          playSound("done");
        } else {
          setSimDispenseL(parseFloat(curr.toFixed(1)));
        }
      }, 100);
    } else {
      if (flowTimerRef.current) clearInterval(flowTimerRef.current);
      setSimIsFlowing(false);
      setSimFlowRate(0);
      if (activeStep > 7) {
        setSimDispenseL(activePresetQty);
      } else if (activeStep < 7) {
        setSimDispenseL(0);
      }
    }

    if (activeStep === 11) {
      playSound("done");
    }
  }, [activeStep, activePresetQty]);

  // Auto-play simulation through the 11 steps
  useEffect(() => {
    let timer: any;
    if (isAutoPlaying) {
      const interval = playSpeed === "fast" ? 1800 : 3200;
      timer = setInterval(() => {
        setActiveStep((prev) => {
          if (prev >= 11) {
            setIsAutoPlaying(false);
            return 11;
          }
          return prev + 1;
        });
      }, interval);
    }
    return () => clearInterval(timer);
  }, [isAutoPlaying, playSpeed]);

  const activeStepObj = ADBLUE_STEPS[activeStep - 1] || ADBLUE_STEPS[0];

  return (
    <div className={`adblue-workflow-root ${isModal ? "is-modal-style" : ""}`}>
      {/* Top Title Banner matching Image 1 Header */}
      <div className="workflow-hero-header">
        <div className="hero-left-branding">
          <div className="nimblevision-logo-badge">
            <div className="nimble-logo-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="url(#nv-head-grad)" />
                <path d="M7 16C9.8 10.5 22.2 10.5 25 16C22.2 21.5 9.8 21.5 7 16Z" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="16" cy="16" r="4" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
                <defs>
                  <linearGradient id="nv-head-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#0284c7" />
                    <stop offset="1" stopColor="#0f172a" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="logo-text-block">
              <span className="logo-main">NIMBLE VISION</span>
              <span className="logo-sub">PVT LTD</span>
              <span className="logo-tagline">IoT Smart Refilling Solutions • Track • Monitor • Cleaner Tomorrow</span>
            </div>
          </div>
        </div>

        <div className="hero-center-titles">
          <h1 className="process-headline">Automated AdBlue Refilling Process</h1>
          <h2 className="process-tagline">Smart Refilling for Cleaner Vehicles</h2>
          <div className="process-pipeline-breadcrumb">
            {ADBLUE_STEPS.map((s, idx) => (
              <React.Fragment key={s.number}>
                <span
                  onClick={() => setActiveStep(s.number)}
                  className={`bread-step ${activeStep === s.number ? "active" : activeStep > s.number ? "passed" : ""}`}
                >
                  {s.number}. {s.title.split(" ")[0]}
                </span>
                {idx < ADBLUE_STEPS.length - 1 && <span className="arrow">→</span>}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="hero-right-branding">
          <div className="almarai-logo-badge">
            <div className="almarai-arabic">المراعي</div>
            <div className="almarai-english">Almarai</div>
          </div>
          <div className="slogan-block">
            <span>CLEANER VEHICLES</span>
            <span>GREENER TOMORROW</span>
          </div>
          {isModal && onClose && (
            <button onClick={onClose} className="modal-close-btn" title="Close">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Interactive Controls & Presenter Toolbar */}
      <div className="workflow-controls-bar">
        <div className="controls-left">
          <div className="step-counter-pill">
            STAGE <span className="counter-accent">{activeStep}</span> OF 11:{" "}
            <strong className="counter-title">{activeStepObj.title}</strong>
          </div>
          <span className="stage-sub-badge">{activeStepObj.subtitle}</span>
        </div>

        <div className="action-buttons-wrap">
          <button
            className={`btn-step-control ${isAutoPlaying ? "active-playing" : "primary"}`}
            onClick={() => {
              setIsAutoPlaying(!isAutoPlaying);
              playSound("click");
            }}
          >
            {isAutoPlaying ? "⏸ Pause Auto Demo" : "▶ Run Interactive Demo"}
          </button>

          <button
            className="btn-step-control"
            disabled={activeStep <= 1}
            onClick={() => {
              setActiveStep((s) => Math.max(1, s - 1));
              playSound("click");
            }}
          >
            ◀ Prev Stage
          </button>
          <button
            className="btn-step-control"
            disabled={activeStep >= 11}
            onClick={() => {
              setActiveStep((s) => Math.min(11, s + 1));
              playSound("click");
            }}
          >
            Next Stage ▶
          </button>

          <button
            className={`btn-step-control toggle ${playSpeed === "fast" ? "active" : ""}`}
            onClick={() => setPlaySpeed((s) => (s === "normal" ? "fast" : "normal"))}
            title="Adjust demo playback speed"
          >
            ⚡ {playSpeed === "fast" ? "Speed: 2x Fast" : "Speed: 1x Normal"}
          </button>

          <button
            className={`btn-step-control toggle ${soundEnabled ? "active" : ""}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title="Toggle synthetic audio feedback"
          >
            {soundEnabled ? "🔊 Sound ON" : "🔇 Sound OFF"}
          </button>

          <button
            className={`btn-step-control toggle ${showPitchGuide ? "active" : ""}`}
            onClick={() => setShowPitchGuide(!showPitchGuide)}
            title="Toggle presenter talking points"
          >
            🎙️ {showPitchGuide ? "Hide Pitch Notes" : "Show Pitch Notes"}
          </button>

          <button
            className="btn-step-control reset"
            onClick={() => {
              setIsAutoPlaying(false);
              setActiveStep(1);
              playSound("click");
            }}
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------------------
          INTERACTIVE LIVE DEMO HERO SHOWCASE (High-Impact Active Stage View)
          -------------------------------------------------------------------- */}
      <div className="interactive-hero-stage-panel">
        <div className="hero-stage-main">
          {/* Left Column: Live Graphic Animation for Active Stage */}
          <div className="stage-visual-container">
            {activeStep === 1 && (
              <div className="stage-visual-scene vehicle-arrival-scene">
                <div className="scene-badge">KHARJ CENTRAL DEPOT · BAY 1 ENTRY</div>
                <div className="animated-truck-entry">
                  <div className="truck-symbol">🚛</div>
                  <div className="truck-label">{activeVehicleNo}</div>
                  <div className="radar-waves">
                    <span className="pulse-ring r1" />
                    <span className="pulse-ring r2" />
                  </div>
                </div>
                <div className="scene-status-pill">
                  <span className="live-dot" /> <b>INSIDE 250m GEOFENCE</b> · Distance: 24m · Speed: 0 km/h
                </div>
                <button
                  className="interactive-action-btn"
                  onClick={() => {
                    setActiveStep(2);
                    playSound("scan");
                  }}
                >
                  📸 Proceed to Waybill Barcode Scan ➔
                </button>
              </div>
            )}

            {activeStep === 2 && (
              <div className="stage-visual-scene barcode-scan-scene">
                <div className="scene-badge">BAY 1 DISPENSER LASER SCANNER</div>
                <div className="scanner-gun-assembly">
                  <div className={`laser-emitter ${laserPulsing ? "active-beam" : ""}`}>
                    <div className="red-laser-sweep" />
                  </div>
                  <div className="physical-waybill-card animate-float">
                    <div className="wb-almarai-logo">المراعي Almarai</div>
                    <div className="wb-title">OFFICIAL FREIGHT WAYBILL PASS</div>
                    <div className="wb-barcode-art">||||| | |||| |||||| || | ||||</div>
                    <div className="wb-fo-number">FO #{activeWaybillNo}</div>
                    <div className="wb-vehicle-tag">Vehicle: {activeVehicleNo}</div>
                    <div className="wb-badge">AdBlue® ONLY</div>
                  </div>
                </div>
                <button
                  className="interactive-action-btn"
                  onClick={() => {
                    playSound("scan");
                    setActiveStep(3);
                  }}
                >
                  ⚡ Trigger Optical Scan &amp; Authenticate ➔
                </button>
              </div>
            )}

            {activeStep === 3 && (
              <div className="stage-visual-scene vehicle-verify-scene">
                <div className="scene-badge">CENTRAL ERP &amp; WAYBILL RULES ENGINE</div>
                <div className="almarai-lcd-monitor">
                  <div className="lcd-header">
                    <span className="lcd-logo">المراعي Almarai</span>
                    <span className="lcd-time">{currentDateFormatted}</span>
                  </div>
                  <div className="lcd-success-title">
                    <span className="green-tick">✔</span> Vehicle Verified
                  </div>
                  <div className="lcd-rules-table">
                    <div className="lcd-rule-row">
                      <span>Vehicle No:</span>
                      <strong>{activeVehicleNo} (TRACTOR HCV)</strong>
                      <span className="rule-ok">✓ MATCH</span>
                    </div>
                    <div className="lcd-rule-row">
                      <span>Waybill No:</span>
                      <strong>FO #{activeWaybillNo}</strong>
                      <span className="rule-ok">✓ ACTIVE</span>
                    </div>
                    <div className="lcd-rule-row">
                      <span>Depot Geofence:</span>
                      <strong>Almarai Kharj (48m Inside)</strong>
                      <span className="rule-ok">✓ VERIFIED</span>
                    </div>
                    <div className="lcd-rule-row">
                      <span>AdBlue Quota:</span>
                      <strong>{activePresetQty} Litres (ISO 22241)</strong>
                      <span className="rule-ok">✓ AVAILABLE</span>
                    </div>
                  </div>
                </div>
                <button
                  className="interactive-action-btn"
                  onClick={() => {
                    playSound("click");
                    setActiveStep(4);
                  }}
                >
                  🔒 Send Authorization Signal to Dispenser ➔
                </button>
              </div>
            )}

            {activeStep === 4 && (
              <div className="stage-visual-scene dispenser-auth-scene">
                <div className="scene-badge">NV50 EDGE CONTROLLER · PLC INTERFACE</div>
                <div className="relay-circuit-box">
                  <div className="relay-lock-icon">🔒</div>
                  <div className="relay-main-status">DISPENSER AUTHORIZED</div>
                  <div className="relay-sub">Hardware Solenoid Valve Circuit: ARMED</div>
                  <div className="auth-token-tag">Token: auth_9f82_{activeWaybillNo.slice(-4)}</div>
                </div>
                <button
                  className="interactive-action-btn"
                  onClick={() => {
                    playSound("click");
                    setActiveStep(5);
                  }}
                >
                  🟢 Arm Dispenser LCD Screen ➔
                </button>
              </div>
            )}

            {activeStep === 5 && (
              <div className="stage-visual-scene ready-refilling-scene">
                <div className="scene-badge">DISPENSER LCD TERMINAL DISPLAY</div>
                <div className="almarai-lcd-monitor green-glow">
                  <div className="lcd-header">
                    <span className="lcd-logo">المراعي Almarai</span>
                    <span className="lcd-badge-armed">🟢 PUMP SOLENOID ARMED</span>
                  </div>
                  <div className="ready-big-icon">⛽</div>
                  <div className="ready-big-text">Ready for AdBlue Refilling</div>
                  <div className="ready-instructions">Insert nozzle into vehicle tank and press trigger</div>
                  <div className="ready-preset-badge">Authorized Preset: {activePresetQty} L</div>
                </div>
                <button
                  className="interactive-action-btn"
                  onClick={() => {
                    playSound("click");
                    setActiveStep(6);
                  }}
                >
                  ⛽ Lift Nozzle &amp; Insert into Tank ➔
                </button>
              </div>
            )}

            {activeStep === 6 && (
              <div className="stage-visual-scene nozzle-insert-scene">
                <div className="scene-badge">VEHICLE TANK INLET DOCK</div>
                <div className="nozzle-inlet-graphic">
                  <div className="vehicle-tank-flange">
                    <span className="tank-label">AdBlue® DEF ONLY</span>
                  </div>
                  <div className="nozzle-gun-inserted">
                    <span className="gun-icon">🔫</span>
                    <span className="sparkle-prompt">Trigger Engaged</span>
                  </div>
                </div>
                <button
                  className="interactive-action-btn"
                  onClick={() => {
                    playSound("click");
                    setActiveStep(7);
                  }}
                >
                  ▶ Press Dispenser Gun Trigger to Start Flow ➔
                </button>
              </div>
            )}

            {activeStep === 7 && (
              <div className="stage-visual-scene live-dispensing-scene">
                <div className="scene-badge">HIGH-SPEED PULSE FLOW METER (38.6 LPM)</div>
                <div className="almarai-lcd-monitor blue-glow">
                  <div className="lcd-header">
                    <span className="lcd-logo">المراعي Almarai</span>
                    <span className="dispensing-pulse-tag">💧 PUMP MOTOR ACTIVE</span>
                  </div>
                  <div className="live-counter-row">
                    <div className="live-qty-box">
                      <span className="qty-lbl">DISPENSED ADBLUE</span>
                      <div className="qty-big-val">
                        {simDispenseL.toFixed(1)} <span className="u">L</span>
                      </div>
                    </div>
                    <div className="live-rate-box">
                      <span className="rate-lbl">FLOW RATE</span>
                      <div className="rate-val">{simFlowRate.toFixed(1)} <span className="u">L/M</span></div>
                    </div>
                  </div>
                  <div className="meter-progress-track">
                    <div
                      className="meter-progress-fill"
                      style={{ width: `${Math.min(100, (simDispenseL / activePresetQty) * 100)}%` }}
                    />
                  </div>
                  <div className="meter-footer-meta">
                    <span>Preset Limit: <b>{activePresetQty} L</b></span>
                    <span>Remaining: <b>{Math.max(0, activePresetQty - simDispenseL).toFixed(1)} L</b></span>
                  </div>
                </div>
                <button
                  className="interactive-action-btn"
                  onClick={() => {
                    playSound("done");
                    setActiveStep(8);
                  }}
                >
                  ⏹ Preset Reached · Return Nozzle to Holder ➔
                </button>
              </div>
            )}

            {activeStep === 8 && (
              <div className="stage-visual-scene nozzle-return-scene">
                <div className="scene-badge">DISPENSER HOLSTER RECEPTACLE</div>
                <div className="holster-seat-graphic">
                  <div className="holster-box">
                    <div className="holster-gun-icon">🔫</div>
                    <div className="holster-lock-pill">🔒 NOZZLE RESTOWED IN HOLDER</div>
                  </div>
                  <div className="microswitch-status">Microswitch Engaged · Solenoid Cutoff Active</div>
                </div>
                <button
                  className="interactive-action-btn"
                  onClick={() => {
                    playSound("click");
                    setActiveStep(9);
                  }}
                >
                  📝 Generate Digital Transaction Record ➔
                </button>
              </div>
            )}

            {activeStep === 9 && (
              <div className="stage-visual-scene transaction-record-scene">
                <div className="scene-badge">LOCAL TRANSACTION RECORDING</div>
                <div className="almarai-lcd-monitor green-glow">
                  <div className="lcd-header">
                    <span className="lcd-logo">المراعي Almarai</span>
                    <span className="lcd-badge-armed">✓ REFILLING COMPLETED</span>
                  </div>
                  <div className="receipt-summary-grid">
                    <div className="receipt-row"><span>Vehicle No:</span><strong>{activeVehicleNo}</strong></div>
                    <div className="receipt-row"><span>Waybill No:</span><strong>FO #{activeWaybillNo}</strong></div>
                    <div className="receipt-row"><span>Quantity Dispensed:</span><strong style={{ color: "#34d399", fontSize: "15px" }}>{activePresetQty.toFixed(1)} Litres</strong></div>
                    <div className="receipt-row"><span>Product:</span><strong>High-Purity AdBlue DEF (ISO 22241)</strong></div>
                    <div className="receipt-row"><span>Date &amp; Time:</span><strong>{currentDateFormatted}</strong></div>
                    <div className="receipt-row"><span>Transaction ID:</span><strong>AD{Math.floor(1000000 + Math.random() * 9000000)}</strong></div>
                  </div>
                </div>
                <button
                  className="interactive-action-btn"
                  onClick={() => {
                    playSound("click");
                    setActiveStep(10);
                  }}
                >
                  ☁️ Stream Telemetry to Cloud &amp; SAP Outbox ➔
                </button>
              </div>
            )}

            {activeStep === 10 && (
              <div className="stage-visual-scene cloud-transfer-scene">
                <div className="scene-badge">CLOUD IOT PLATFORM &amp; SAP ERP SYNC</div>
                <div className="cloud-network-diagram">
                  <div className="cloud-node central-server">
                    <span className="cloud-symbol">☁️</span>
                    <span className="cloud-name">Almarai Central Cloud</span>
                    <span className="cloud-tag">SAP Material Document #4901824102</span>
                  </div>
                  <div className="client-dashboards-row">
                    <span className="dash-pill">🖥️ Supervisor Forecourt</span>
                    <span className="dash-pill">📱 Driver Mobile App</span>
                    <span className="dash-pill">📊 Inventory Ledger</span>
                  </div>
                  <div className="sync-status-badge">✓ Real-time Telemetry Synced (Latency: 84ms)</div>
                </div>
                <button
                  className="interactive-action-btn"
                  onClick={() => {
                    playSound("done");
                    setActiveStep(11);
                  }}
                >
                  ✅ Complete Cycle &amp; Ready for Next Vehicle ➔
                </button>
              </div>
            )}

            {activeStep === 11 && (
              <div className="stage-visual-scene system-ready-scene">
                <div className="scene-badge">CYCLE COMPLETED · BAY 1 CLEARED</div>
                <div className="system-ready-graphic">
                  <div className="ready-check-circle">✔</div>
                  <div className="ready-title-text">Ready for Next Vehicle</div>
                  <div className="ready-sub-text">
                    Bay 1 Solenoid Locked • Dispenser Reset • Real-time Report Updated
                  </div>
                </div>
                <div className="dual-action-buttons">
                  <button
                    className="interactive-action-btn loop-restart"
                    onClick={() => {
                      setActiveStep(1);
                      playSound("click");
                    }}
                  >
                    ↺ Restart Demo Cycle
                  </button>
                  {onNavigateToReport && (
                    <button
                      className="interactive-action-btn view-report-cta"
                      onClick={() => onNavigateToReport()}
                    >
                      📊 View in Official Generated Report ➔
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Presenter Pitch Guide / Talking Points & Technical Specs */}
          <div className="stage-pitch-guide-container">
            <div className="guide-header">
              <div className="guide-tag">🎙️ PRESENTER PITCH GUIDE</div>
              <div className="guide-stage-title">Stage {activeStep}: {activeStepObj.title}</div>
            </div>

            <div className="guide-card talking-points-box">
              <div className="guide-card-label">WHAT TO HIGHLIGHT TO STAKEHOLDERS:</div>
              <p className="guide-card-content">{activeStepObj.talkingPoint}</p>
            </div>

            <div className="guide-card technical-specs-box">
              <div className="guide-card-label">IOT &amp; EDGE ARCHITECTURE:</div>
              <p className="guide-card-content">{activeStepObj.technicalNote}</p>
            </div>

            <div className="quick-step-jump-strip">
              <div className="jump-title">QUICK JUMP TO STAGE:</div>
              <div className="jump-buttons-row">
                {ADBLUE_STEPS.map((s) => (
                  <button
                    key={s.number}
                    className={`jump-btn ${activeStep === s.number ? "active" : ""}`}
                    onClick={() => {
                      setActiveStep(s.number);
                      playSound("click");
                    }}
                    title={`Stage ${s.number}: ${s.title}`}
                  >
                    {s.number}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------
          THE 11 STEPS INTERACTIVE CARDS GRID (Synchronized with Active Stage)
          -------------------------------------------------------------------- */}
      <div className="steps-section-divider">
        <span>ALL 11 AUTOMATED STAGES (CLICK TO INSPECT)</span>
      </div>

      {/* Row 1: Steps 1 to 6 */}
      <div className="workflow-steps-grid top-row">
        {ADBLUE_STEPS.slice(0, 6).map((step) => {
          const isActive = step.number === activeStep;
          const isCompleted = step.number < activeStep;
          return (
            <div
              key={step.number}
              onClick={() => {
                setActiveStep(step.number);
                playSound("click");
              }}
              className={`workflow-step-card ${isActive ? "is-active" : ""} ${isCompleted ? "is-completed" : ""}`}
            >
              <div className="step-badge-header">
                <span className="step-index-circle">{step.number}</span>
                <span className="step-card-title">{step.title}</span>
              </div>

              {/* Visual Presentation Area */}
              <div className="step-visual-box">
                {step.number === 1 && (
                  <div className="visual-graphic vehicle-arrival">
                    <div className="depot-roof">ALMARAI KHARJ ADBLUE STATION</div>
                    <div className="truck-graphic">🚛</div>
                    <div className="sub-caption">Designated Bay Arrival</div>
                  </div>
                )}

                {step.number === 2 && (
                  <div className="visual-graphic barcode-scan">
                    <div className="scanner-unit-box">
                      <div className="scanner-sensor red-laser" />
                      <div className="waybill-paper">
                        <div className="paper-header">Almarai Waybill No</div>
                        <div className="paper-barcode">||||||||||||||||</div>
                        <div className="paper-no">{activeWaybillNo}</div>
                      </div>
                      <div className="adblue-dispenser-tag">AdBlue® ONLY</div>
                    </div>
                  </div>
                )}

                {step.number === 3 && (
                  <div className="visual-graphic lcd-screen verified">
                    <div className="screen-almarai-logo">المراعي Almarai</div>
                    <div className="screen-verified-icon">✔</div>
                    <div className="screen-main-status">Vehicle Verified</div>
                    <div className="screen-kv-table">
                      <div className="screen-kv-row"><span>Vehicle No:</span><strong>{activeVehicleNo}</strong></div>
                      <div className="screen-kv-row"><span>Waybill No:</span><strong>{activeWaybillNo}</strong></div>
                      <div className="screen-kv-row"><span>Fleet:</span><strong>Almarai Logistics</strong></div>
                      <div className="screen-kv-row"><span>Vehicle Type:</span><strong>Truck (HCV)</strong></div>
                    </div>
                  </div>
                )}

                {step.number === 4 && (
                  <div className="visual-graphic lcd-screen authorized">
                    <div className="screen-almarai-logo">المراعي Almarai</div>
                    <div className="screen-lock-icon">🔒</div>
                    <div className="screen-auth-status">Dispenser Authorized</div>
                    <div className="screen-sub-auth">Solenoid Relay Ready</div>
                  </div>
                )}

                {step.number === 5 && (
                  <div className="visual-graphic lcd-screen ready">
                    <div className="screen-almarai-logo">المراعي Almarai</div>
                    <div className="screen-pump-icon">⛽</div>
                    <div className="screen-ready-status">Ready for AdBlue Refilling</div>
                    <div className="screen-prompt">Insert nozzle and press trigger</div>
                  </div>
                )}

                {step.number === 6 && (
                  <div className="visual-graphic nozzle-insert">
                    <div className="adblue-nozzle-badge">AdBlue® ONLY</div>
                    <div className="nozzle-gun-graphic">
                      <span className="nozzle-tip">⎯</span>
                      <span className="nozzle-gun">🔫</span>
                    </div>
                    <div className="nozzle-prompt">Trigger Pressed</div>
                  </div>
                )}
              </div>

              <div className="step-desc-text">{step.description}</div>
            </div>
          );
        })}
      </div>

      {/* Row 2: Steps 7 to 11 */}
      <div className="workflow-steps-grid bottom-row">
        {ADBLUE_STEPS.slice(6, 11).map((step) => {
          const isActive = step.number === activeStep;
          const isCompleted = step.number < activeStep;
          return (
            <div
              key={step.number}
              onClick={() => {
                setActiveStep(step.number);
                playSound("click");
              }}
              className={`workflow-step-card ${isActive ? "is-active" : ""} ${isCompleted ? "is-completed" : ""}`}
            >
              <div className="step-badge-header">
                <span className="step-index-circle">{step.number}</span>
                <span className="step-card-title">{step.title}</span>
              </div>

              <div className="step-visual-box">
                {step.number === 7 && (
                  <div className="visual-graphic lcd-screen dispensing">
                    <div className="screen-almarai-logo">المراعي Almarai</div>
                    <div className="screen-flow-title">Dispensing AdBlue...</div>
                    <div className="screen-progress-bar-wrap">
                      <div className="screen-progress-bar-fill" style={{ width: "75%" }} />
                    </div>
                    <div className="screen-counter-val">
                      Quantity (L): <strong>{activePresetQty.toFixed(1)} / {activePresetQty.toFixed(1)}</strong>
                    </div>
                    <div className="adblue-inline-badge">AdBlue® ONLY</div>
                  </div>
                )}

                {step.number === 8 && (
                  <div className="visual-graphic nozzle-holster">
                    <div className="holster-bracket">
                      <div className="holster-gun-icon">🔫</div>
                      <div className="holster-status">Returned to Holder</div>
                    </div>
                    <div className="adblue-inline-badge">AdBlue®</div>
                  </div>
                )}

                {step.number === 9 && (
                  <div className="visual-graphic lcd-screen completed">
                    <div className="screen-almarai-logo">المراعي Almarai</div>
                    <div className="screen-done-icon">✔</div>
                    <div className="screen-done-title">Refilling Completed</div>
                    <div className="screen-kv-table">
                      <div className="screen-kv-row"><span>Vehicle No:</span><strong>{activeVehicleNo}</strong></div>
                      <div className="screen-kv-row"><span>Waybill No:</span><strong>{activeWaybillNo}</strong></div>
                      <div className="screen-kv-row"><span>Quantity Dispensed:</span><strong>{activePresetQty.toFixed(1)} L</strong></div>
                      <div className="screen-kv-row"><span>Date &amp; Time:</span><strong>{currentDateFormatted || "14 Sep 2026, 10:24"}</strong></div>
                      <div className="screen-kv-row"><span>Transaction ID:</span><strong>AD1234567</strong></div>
                    </div>
                  </div>
                )}

                {step.number === 10 && (
                  <div className="visual-graphic cloud-sync">
                    <div className="cloud-icon-badge">☁️ Cloud Server</div>
                    <div className="cloud-devices-row">
                      <span className="device-pc">🖥️ Desktop</span>
                      <span className="device-tab">📱 Tablet</span>
                      <span className="device-phone">📱 Mobile</span>
                    </div>
                    <div className="sync-status">Real-time SAP Outbox Sync</div>
                  </div>
                )}

                {step.number === 11 && (
                  <div className="visual-graphic system-ready">
                    <div className="depot-roof">ALMARAI KHARJ STATION</div>
                    <div className="ready-truck-box">
                      <span className="ready-icon">✔</span>
                      <span className="ready-badge-text">Ready for Next Vehicle</span>
                    </div>
                    <div className="sub-caption">Bay Reset • Dispenser Locked</div>
                  </div>
                )}
              </div>

              <div className="step-desc-text">{step.description}</div>
            </div>
          );
        })}
      </div>

      {/* Value Badges Footer matching Image 1 bottom footer */}
      <div className="workflow-footer-badges">
        <div className="badge-item">
          <span className="badge-icon">🛡️</span>
          <span className="badge-text">Authorized Refills Only</span>
        </div>
        <div className="badge-item">
          <span className="badge-icon">💧</span>
          <span className="badge-text">Accurate Measurement</span>
        </div>
        <div className="badge-item">
          <span className="badge-icon">📋</span>
          <span className="badge-text">Digital Traceability</span>
        </div>
        <div className="badge-item">
          <span className="badge-icon">📊</span>
          <span className="badge-text">Real-time Monitoring</span>
        </div>
        <div className="badge-item">
          <span className="badge-icon">🗄️</span>
          <span className="badge-text">Better Inventory Management</span>
        </div>
        <div className="badge-item">
          <span className="badge-icon">⚙️</span>
          <span className="badge-text">Minimal Manual Intervention</span>
        </div>
        <div className="badge-item">
          <span className="badge-icon">🌱</span>
          <span className="badge-text">Cleaner Environment</span>
        </div>
        <div className="badge-item driving-tomorrow">
          <span className="leaf-icon">🍃</span>
          <span className="badge-text">Driving Sustainable Tomorrow</span>
        </div>
      </div>

      <style>{`
        .adblue-workflow-root {
          background: #ffffff;
          color: #0f172a;
          border-radius: 12px;
          padding: 24px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          box-sizing: border-box;
          box-shadow: 0 4px 25px rgba(0, 0, 0, 0.15);
        }
        .adblue-workflow-root.is-modal-style {
          max-height: 90vh;
          overflow-y: auto;
          background: #f8fafc;
        }

        /* Hero Header */
        .workflow-hero-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .nimblevision-logo-badge {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .nimble-logo-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 2px 6px rgba(2, 132, 199, 0.25));
        }
        .logo-text-block {
          display: flex;
          flex-direction: column;
        }
        .logo-main {
          font-size: 16px;
          font-weight: 900;
          color: #0369a1;
          letter-spacing: 0.05em;
          line-height: 1.1;
        }
        .logo-sub {
          font-size: 12px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: 0.15em;
          line-height: 1.1;
        }
        .logo-tagline {
          font-size: 8.5px;
          color: #64748b;
          font-weight: 500;
          margin-top: 2px;
        }

        .hero-center-titles {
          text-align: center;
          flex: 1;
          min-width: 320px;
        }
        .process-headline {
          font-size: 24px;
          font-weight: 800;
          color: #0284c7;
          margin: 0;
          letter-spacing: -0.01em;
        }
        .process-tagline {
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          margin: 4px 0 10px 0;
        }
        .process-pipeline-breadcrumb {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 700;
          color: #0369a1;
          flex-wrap: wrap;
          background: #f0f9ff;
          padding: 6px 14px;
          border-radius: 20px;
          border: 1px solid #bae6fd;
        }
        .bread-step {
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .bread-step:hover {
          background: #bae6fd;
        }
        .bread-step.active {
          background: #0284c7;
          color: #ffffff;
        }
        .bread-step.passed {
          color: #059669;
        }
        .process-pipeline-breadcrumb .arrow {
          color: #94a3b8;
        }

        .hero-right-branding {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .almarai-logo-badge {
          text-align: right;
        }
        .almarai-arabic {
          font-size: 18px;
          font-weight: 800;
          color: #0284c7;
          line-height: 1;
        }
        .almarai-english {
          font-size: 14px;
          font-weight: 800;
          color: #0284c7;
          line-height: 1;
        }
        .slogan-block {
          display: flex;
          flex-direction: column;
          font-size: 9px;
          font-weight: 800;
          color: #059669;
          letter-spacing: 0.05em;
          border-left: 2px solid #10b981;
          padding-left: 8px;
        }
        .modal-close-btn {
          background: #e2e8f0;
          border: none;
          color: #475569;
          border-radius: 6px;
          width: 32px;
          height: 32px;
          font-size: 16px;
          cursor: pointer;
        }

        /* Controls Bar */
        .workflow-controls-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 10px;
          background: #0f172a;
          color: #f8fafc;
          padding: 10px 16px;
          border-radius: 8px;
        }
        .controls-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .step-counter-pill {
          font-size: 12px;
          font-weight: 700;
          color: #cbd5e1;
        }
        .counter-accent {
          color: #38bdf8;
          font-size: 15px;
          font-weight: 800;
        }
        .counter-title {
          color: #ffffff;
        }
        .stage-sub-badge {
          font-size: 10px;
          font-weight: 700;
          background: rgba(14, 165, 233, 0.2);
          color: #38bdf8;
          border: 1px solid rgba(14, 165, 233, 0.4);
          padding: 3px 8px;
          border-radius: 4px;
        }

        .action-buttons-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .btn-step-control {
          background: #1e293b;
          border: 1px solid #334155;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
          color: #f8fafc;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-step-control:hover:not(:disabled) {
          background: #334155;
          border-color: #64748b;
        }
        .btn-step-control.primary {
          background: #0284c7;
          border-color: #0284c7;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4);
        }
        .btn-step-control.active-playing {
          background: #ef4444;
          color: #ffffff;
          border-color: #ef4444;
          animation: pulse 1.5s infinite;
        }
        .btn-step-control.toggle.active {
          background: rgba(16, 185, 129, 0.25);
          color: #34d399;
          border-color: #10b981;
        }
        .btn-step-control.reset {
          color: #f87171;
        }
        .btn-step-control:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* --------------------------------------------------------------------
           INTERACTIVE HERO STAGE PANEL
           -------------------------------------------------------------------- */
        .interactive-hero-stage-panel {
          background: #f8fafc;
          border: 2px solid #0284c7;
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 20px;
          box-shadow: 0 10px 25px -5px rgba(2, 132, 199, 0.15);
        }
        .hero-stage-main {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        @media (max-width: 900px) {
          .hero-stage-main {
            grid-template-columns: 1fr;
          }
        }

        .stage-visual-container {
          background: #0f172a;
          color: #ffffff;
          border-radius: 8px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 280px;
          border: 1px solid #1e293b;
        }
        .stage-visual-scene {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
        }
        .scene-badge {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.1em;
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.15);
          padding: 3px 10px;
          border-radius: 4px;
          margin-bottom: 12px;
          text-transform: uppercase;
        }

        /* Scene 1: Arrival */
        .animated-truck-entry {
          position: relative;
          margin: 10px 0;
        }
        .truck-symbol {
          font-size: 48px;
        }
        .truck-label {
          font-size: 11px;
          font-weight: 800;
          color: #38bdf8;
          font-family: monospace;
          margin-top: 2px;
        }
        .radar-waves {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
        .pulse-ring {
          position: absolute;
          top: -30px;
          left: -30px;
          width: 60px;
          height: 60px;
          border: 2px solid #22d3ee;
          border-radius: 50%;
          animation: radarWave 2s infinite ease-out;
        }
        .pulse-ring.r2 {
          animation-delay: 1s;
        }
        @keyframes radarWave {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .scene-status-pill {
          font-size: 11px;
          color: #94a3b8;
          background: #1e293b;
          padding: 6px 12px;
          border-radius: 6px;
          margin: 10px 0 16px 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 8px #22c55e;
        }

        /* Scene 2: Barcode */
        .scanner-gun-assembly {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          margin: 8px 0 14px 0;
        }
        .laser-emitter {
          width: 140px;
          height: 4px;
          background: #ef4444;
          box-shadow: 0 0 12px #ef4444;
          border-radius: 2px;
          margin-bottom: 8px;
          position: relative;
          overflow: hidden;
        }
        .laser-emitter.active-beam {
          animation: laserGlow 1s infinite alternate;
        }
        @keyframes laserGlow {
          from { opacity: 0.7; box-shadow: 0 0 8px #ef4444; }
          to { opacity: 1; box-shadow: 0 0 16px #ef4444; }
        }
        .physical-waybill-card {
          background: #ffffff;
          color: #0f172a;
          border: 2px solid #cbd5e1;
          border-radius: 6px;
          padding: 10px 16px;
          box-shadow: 0 6px 16px rgba(0,0,0,0.3);
          width: 190px;
          text-align: center;
        }
        .wb-almarai-logo {
          font-size: 10px;
          font-weight: 800;
          color: #0284c7;
        }
        .wb-title {
          font-size: 8px;
          font-weight: 700;
          color: #475569;
          margin-bottom: 4px;
        }
        .wb-barcode-art {
          font-family: monospace;
          font-size: 14px;
          letter-spacing: 2px;
          color: #000;
          font-weight: 900;
        }
        .wb-fo-number {
          font-family: monospace;
          font-size: 11px;
          font-weight: 800;
          color: #0369a1;
        }
        .wb-vehicle-tag {
          font-size: 9px;
          color: #64748b;
          margin-top: 2px;
        }
        .wb-badge {
          background: #e0f2fe;
          color: #0369a1;
          font-size: 8px;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 3px;
          margin-top: 4px;
          display: inline-block;
        }

        /* LCD Monitors */
        .almarai-lcd-monitor {
          background: #020617;
          border: 2px solid #334155;
          border-radius: 6px;
          padding: 12px 16px;
          width: 90%;
          box-sizing: border-box;
          margin-bottom: 14px;
        }
        .almarai-lcd-monitor.green-glow {
          border-color: #22c55e;
          box-shadow: 0 0 15px rgba(34, 197, 94, 0.2);
        }
        .almarai-lcd-monitor.blue-glow {
          border-color: #0284c7;
          box-shadow: 0 0 15px rgba(2, 132, 199, 0.3);
        }
        .lcd-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 4px;
          margin-bottom: 8px;
        }
        .lcd-logo {
          font-size: 10px;
          font-weight: 800;
          color: #38bdf8;
        }
        .lcd-time {
          font-size: 9px;
          color: #94a3b8;
          font-family: monospace;
        }
        .lcd-success-title {
          font-size: 14px;
          font-weight: 800;
          color: #22c55e;
          margin-bottom: 8px;
        }
        .green-tick {
          font-size: 16px;
          margin-right: 4px;
        }
        .lcd-rules-table {
          display: flex;
          flex-direction: column;
          gap: 4px;
          text-align: left;
        }
        .lcd-rule-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9.5px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding: 2px 0;
        }
        .lcd-rule-row span { color: #94a3b8; }
        .lcd-rule-row strong { color: #f8fafc; }
        .rule-ok {
          color: #22c55e !important;
          font-weight: 800;
          font-size: 9px;
        }

        /* Relay Circuit */
        .relay-circuit-box {
          background: #020617;
          border: 2px solid #0284c7;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 14px;
          text-align: center;
        }
        .relay-lock-icon { font-size: 32px; color: #38bdf8; }
        .relay-main-status {
          font-size: 15px;
          font-weight: 800;
          color: #38bdf8;
          margin: 6px 0 2px 0;
        }
        .relay-sub { font-size: 11px; color: #94a3b8; }
        .auth-token-tag {
          font-family: monospace;
          font-size: 10px;
          background: #1e293b;
          color: #a5f3fc;
          padding: 3px 8px;
          border-radius: 4px;
          margin-top: 8px;
          display: inline-block;
        }

        /* Ready Screen */
        .ready-big-icon { font-size: 34px; color: #22c55e; }
        .ready-big-text { font-size: 15px; font-weight: 800; color: #22c55e; }
        .ready-instructions { font-size: 10px; color: #94a3b8; margin: 4px 0 8px 0; }
        .ready-preset-badge {
          background: #064e3b;
          color: #34d399;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 4px;
          display: inline-block;
        }

        /* Nozzle Insert */
        .nozzle-inlet-graphic {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 14px;
        }
        .vehicle-tank-flange {
          background: #0284c7;
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 4px;
          margin-bottom: 10px;
        }
        .nozzle-gun-inserted {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .gun-icon { font-size: 36px; }
        .sparkle-prompt {
          font-size: 11px;
          color: #34d399;
          font-weight: 700;
        }

        /* Live Dispensing Meter */
        .live-counter-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .live-qty-box { text-align: left; }
        .qty-lbl, .rate-lbl { font-size: 8.5px; color: #94a3b8; font-weight: 700; }
        .qty-big-val { font-size: 28px; font-weight: 900; color: #38bdf8; font-family: monospace; }
        .qty-big-val .u { font-size: 14px; }
        .rate-val { font-size: 16px; font-weight: 800; color: #22c55e; font-family: monospace; }
        .meter-progress-track {
          background: #1e293b;
          height: 10px;
          border-radius: 5px;
          overflow: hidden;
          margin-bottom: 8px;
        }
        .meter-progress-fill {
          background: linear-gradient(90deg, #0284c7, #38bdf8);
          height: 100%;
          border-radius: 5px;
          transition: width 0.1s ease;
        }
        .meter-footer-meta {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #94a3b8;
        }

        /* Holster */
        .holster-box {
          background: #1e293b;
          padding: 14px 20px;
          border-radius: 8px;
          margin-bottom: 10px;
        }
        .holster-gun-icon { font-size: 34px; color: #38bdf8; }
        .holster-lock-pill { font-size: 11px; font-weight: 800; color: #22c55e; margin-top: 4px; }
        .microswitch-status { font-size: 10px; color: #94a3b8; margin-bottom: 14px; }

        /* Receipt */
        .receipt-summary-grid {
          display: flex;
          flex-direction: column;
          gap: 4px;
          text-align: left;
        }
        .receipt-row {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding: 2px 0;
        }
        .receipt-row span { color: #94a3b8; }
        .receipt-row strong { color: #f8fafc; }

        /* Cloud Network */
        .cloud-network-diagram {
          text-align: center;
          margin-bottom: 14px;
        }
        .cloud-symbol { font-size: 38px; color: #38bdf8; }
        .cloud-name { font-size: 13px; font-weight: 800; display: block; color: #f8fafc; }
        .cloud-tag { font-size: 9px; color: #38bdf8; font-family: monospace; display: block; margin-bottom: 8px; }
        .client-dashboards-row {
          display: flex;
          justify-content: center;
          gap: 6px;
          font-size: 9px;
          margin-bottom: 10px;
        }
        .dash-pill {
          background: #1e293b;
          color: #cbd5e1;
          padding: 3px 8px;
          border-radius: 4px;
        }
        .sync-status-badge { font-size: 10.5px; font-weight: 800; color: #34d399; }

        /* System Ready */
        .system-ready-graphic {
          text-align: center;
          margin-bottom: 14px;
        }
        .ready-check-circle {
          font-size: 40px;
          color: #22c55e;
          line-height: 1;
        }
        .ready-title-text {
          font-size: 18px;
          font-weight: 800;
          color: #22c55e;
          margin: 6px 0 4px 0;
        }
        .ready-sub-text {
          font-size: 11px;
          color: #94a3b8;
        }

        /* Interactive Action Buttons inside Stage */
        .interactive-action-btn {
          background: linear-gradient(135deg, #0284c7, #0369a1);
          color: #ffffff;
          border: none;
          padding: 9px 16px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
          width: 100%;
        }
        .interactive-action-btn:hover {
          background: linear-gradient(135deg, #0369a1, #075985);
          transform: translateY(-1px);
        }
        .dual-action-buttons {
          display: flex;
          gap: 8px;
          width: 100%;
        }
        .interactive-action-btn.loop-restart {
          background: #334155;
          flex: 1;
        }
        .interactive-action-btn.view-report-cta {
          background: linear-gradient(135deg, #059669, #10b981);
          flex: 1.5;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }

        /* Presenter Guide Right Column */
        .stage-pitch-guide-container {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .guide-header {
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .guide-tag {
          font-size: 10px;
          font-weight: 800;
          color: #0284c7;
          letter-spacing: 0.1em;
        }
        .guide-stage-title {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          margin-top: 2px;
        }
        .guide-card {
          border-radius: 6px;
          padding: 10px 12px;
          margin-bottom: 10px;
        }
        .talking-points-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-left: 4px solid #16a34a;
        }
        .technical-specs-box {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-left: 4px solid #2563eb;
        }
        .guide-card-label {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #475569;
          margin-bottom: 4px;
        }
        .guide-card-content {
          font-size: 11.5px;
          line-height: 1.45;
          color: #1e293b;
          margin: 0;
          font-weight: 500;
        }

        .quick-step-jump-strip {
          margin-top: 6px;
          padding-top: 8px;
          border-top: 1px solid #e2e8f0;
        }
        .jump-title {
          font-size: 9px;
          font-weight: 800;
          color: #64748b;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }
        .jump-buttons-row {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }
        .jump-btn {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          width: 26px;
          height: 26px;
          font-size: 11px;
          font-weight: 700;
          color: #334155;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .jump-btn:hover {
          background: #e2e8f0;
          border-color: #94a3b8;
        }
        .jump-btn.active {
          background: #0284c7;
          color: #ffffff;
          border-color: #0284c7;
        }

        /* Divider */
        .steps-section-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 18px 0 12px 0;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.1em;
          color: #64748b;
        }
        .steps-section-divider::before, .steps-section-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e2e8f0;
          margin: 0 12px;
        }

        /* Steps Grids */
        .workflow-steps-grid {
          display: grid;
          gap: 12px;
          margin-bottom: 14px;
        }
        .workflow-steps-grid.top-row {
          grid-template-columns: repeat(6, 1fr);
        }
        .workflow-steps-grid.bottom-row {
          grid-template-columns: repeat(5, 1fr);
        }

        @media (max-width: 1200px) {
          .workflow-steps-grid.top-row, .workflow-steps-grid.bottom-row {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 768px) {
          .workflow-steps-grid.top-row, .workflow-steps-grid.bottom-row {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
          .workflow-top-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          .stage-controls-group {
            flex-wrap: wrap;
            gap: 6px;
            width: 100%;
          }
          .btn-step-control {
            flex: 1 1 auto;
            text-align: center;
            justify-content: center;
            font-size: 11px;
            padding: 6px 8px;
          }
        }
        @media (max-width: 480px) {
          .workflow-steps-grid.top-row, .workflow-steps-grid.bottom-row {
            grid-template-columns: 1fr;
          }
        }

        .workflow-step-card {
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          transition: all 0.2s ease;
          cursor: pointer;
          position: relative;
        }
        .workflow-step-card:hover {
          border-color: #38bdf8;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(14, 165, 233, 0.12);
        }
        .workflow-step-card.is-active {
          border-color: #0284c7;
          background: #f0f9ff;
          box-shadow: 0 0 0 2px #0284c7;
        }
        .workflow-step-card.is-completed {
          border-color: #86efac;
        }

        .step-badge-header {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 8px;
          min-height: 40px;
        }
        .step-index-circle {
          background: #0284c7;
          color: #ffffff;
          font-size: 13px;
          font-weight: 800;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .workflow-step-card.is-active .step-index-circle {
          background: #0369a1;
          box-shadow: 0 0 8px rgba(2, 132, 199, 0.6);
        }
        .step-card-title {
          font-size: 11.5px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.25;
        }

        /* Step Visual Graphic Box */
        .step-visual-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          height: 130px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
          padding: 8px;
          box-sizing: border-box;
          overflow: hidden;
        }

        .visual-graphic {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .depot-roof {
          background: #0284c7;
          color: #ffffff;
          font-size: 8px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 3px;
          margin-bottom: 6px;
          letter-spacing: 0.05em;
        }
        .truck-graphic { font-size: 34px; }
        .sub-caption {
          font-size: 9px;
          color: #64748b;
          font-weight: 600;
          margin-top: 4px;
        }

        .scanner-unit-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .scanner-sensor.red-laser {
          width: 40px;
          height: 3px;
          background: #ef4444;
          box-shadow: 0 0 8px #ef4444;
          border-radius: 2px;
        }
        .waybill-paper {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          padding: 4px 8px;
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .paper-header { font-size: 8px; font-weight: 700; color: #0284c7; }
        .paper-barcode { font-size: 11px; letter-spacing: 2px; font-family: monospace; color: #000; }
        .paper-no { font-size: 9px; font-weight: 800; color: #334155; }
        .adblue-dispenser-tag {
          font-size: 8px;
          font-weight: 800;
          color: #0284c7;
          background: #e0f2fe;
          padding: 1px 6px;
          border-radius: 3px;
        }

        .lcd-screen {
          background: #0f172a;
          color: #ffffff;
          border-radius: 4px;
          padding: 6px 8px;
          border: 2px solid #334155;
          width: 100%;
        }
        .screen-almarai-logo { font-size: 8px; font-weight: 800; color: #38bdf8; margin-bottom: 2px; }
        .screen-verified-icon, .screen-done-icon { color: #22c55e; font-size: 14px; font-weight: 900; }
        .screen-main-status, .screen-done-title { font-size: 10.5px; font-weight: 800; color: #22c55e; margin-bottom: 4px; }
        .screen-kv-table { width: 100%; font-size: 7.5px; line-height: 1.3; text-align: left; }
        .screen-kv-row {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          padding: 1px 0;
        }
        .screen-kv-row span { color: #94a3b8; }
        .screen-kv-row strong { color: #ffffff; }

        .screen-lock-icon { font-size: 20px; color: #38bdf8; margin: 4px 0; }
        .screen-auth-status { font-size: 10px; font-weight: 800; color: #38bdf8; }
        .screen-sub-auth { font-size: 8px; color: #94a3b8; }

        .screen-pump-icon { font-size: 20px; color: #22c55e; }
        .screen-ready-status { font-size: 10px; font-weight: 800; color: #22c55e; }
        .screen-prompt { font-size: 7.5px; color: #94a3b8; }

        .adblue-nozzle-badge {
          background: #0284c7;
          color: #ffffff;
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 3px;
          margin-bottom: 6px;
        }
        .nozzle-gun-graphic { font-size: 28px; }
        .nozzle-prompt { font-size: 9px; font-weight: 700; color: #059669; }

        .screen-flow-title { font-size: 10px; font-weight: 800; color: #38bdf8; margin-bottom: 4px; }
        .screen-progress-bar-wrap {
          background: #334155;
          height: 6px;
          border-radius: 3px;
          width: 90%;
          overflow: hidden;
          margin-bottom: 4px;
        }
        .screen-progress-bar-fill {
          background: #0284c7;
          height: 100%;
          border-radius: 3px;
        }
        .screen-counter-val { font-size: 8px; color: #e2e8f0; margin-bottom: 4px; }
        .adblue-inline-badge {
          background: #0284c7;
          color: #ffffff;
          font-size: 7px;
          font-weight: 800;
          padding: 1px 4px;
          border-radius: 2px;
        }

        .holster-bracket { text-align: center; }
        .holster-gun-icon { font-size: 28px; color: #0284c7; }
        .holster-status { font-size: 9px; font-weight: 700; color: #334155; margin-bottom: 4px; }

        .cloud-icon-badge {
          background: #0284c7;
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 12px;
          margin-bottom: 6px;
        }
        .cloud-devices-row {
          display: flex;
          gap: 6px;
          font-size: 8px;
          color: #475569;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .sync-status { font-size: 8px; font-weight: 700; color: #059669; }

        .ready-truck-box {
          display: flex;
          align-items: center;
          gap: 4px;
          background: #dcfce7;
          padding: 4px 8px;
          border-radius: 4px;
          margin-bottom: 4px;
        }
        .ready-icon { color: #16a34a; font-weight: 900; font-size: 12px; }
        .ready-badge-text { font-size: 9px; font-weight: 800; color: #166534; }

        .step-desc-text {
          font-size: 10px;
          color: #475569;
          line-height: 1.35;
          margin-top: auto;
        }

        /* Footer Value Badges */
        .workflow-footer-badges {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          background: #0284c7;
          color: #ffffff;
          padding: 10px 16px;
          border-radius: 8px;
          margin-top: 14px;
        }
        .badge-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
        }
        .badge-item.driving-tomorrow {
          background: #059669;
          padding: 4px 10px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.3);
        }
      `}</style>
    </div>
  );
};

export default AdBlueProcessWorkflow;
