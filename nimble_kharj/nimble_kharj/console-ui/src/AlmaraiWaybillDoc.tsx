import React, { useState } from "react";
import { autoGenerateArabicDesc, WAYBILL_UI_LABELS } from "./arabicTranslator";

export type AlmaraiWaybillData = {
  waybill_no: string;
  prepared_date?: string;
  schedule_date?: string;
  prepared_by?: string;
  final_destination?: string;
  trip_customer?: string;
  arabic_desc?: string;
  driver_name?: string;
  driver_code?: string;
  tractor_no?: string;
  trailer_no?: string;
  product?: string;
  entitlement_qty?: number;
  dispensed_qty?: number;
  balance_qty?: number;
  station?: string;
  bay_no?: string;
  temp_c?: string;
  seal_1?: string;
  seal_2?: string;
  remark?: string;
};

interface Props {
  data?: Partial<AlmaraiWaybillData>;
  onClose?: () => void;
  onAuthorizePump?: () => void;
  showPumpAction?: boolean;
}

export const AlmaraiWaybillDoc: React.FC<Props> = ({
  data = {},
  onClose,
  onAuthorizePump,
  showPumpAction = true,
}) => {
  const [activePage, setActivePage] = useState<1 | 2 | 3>(1);

  const waybillNo = data.waybill_no || "280820260001";
  const preparedDate = data.prepared_date || "2026-08-13 13:41:22";
  const scheduleDate = data.schedule_date || "13.08.2026 00:00:00";
  const preparedBy = data.prepared_by || "111037 - Gopikrishnan";
  const finalDestination = data.final_destination || "RIYADH SOUTH DEPOT";
  const tripCustomer = data.trip_customer || "CPP RIYADH SOUTH FOODS 01 (CUSTOMER)";
  const arabicDesc = data.arabic_desc || autoGenerateArabicDesc(tripCustomer);
  const driverName = data.driver_name || "175076, AZHAR UD DIN";
  const tractorNo = data.tractor_no || "500609 (ALM-TRK-1041)";
  const trailerNo = data.trailer_no || "26344";
  const bayNo = data.bay_no || "01 (ADB-DU-01)";
  const tempC = data.temp_c || "+22C";
  const remark = data.remark || "R.SOUTH - NUPCO CUSTOMER - RIYADH EAST DEPOT - CPP (COLLECTION OF EXPIRED PRODUCTS FROM NUPCO WH)";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="almarai-waybill-modal-container">
      {/* Modal Actions Bar (Invisible on print) */}
      <div className="almarai-doc-action-bar no-print">
        <div className="almarai-page-tabs">
          <button
            className={`almarai-page-tab ${activePage === 1 ? "active" : ""}`}
            onClick={() => setActivePage(1)}
          >
            Page 1: Office Copy
          </button>
          <button
            className={`almarai-page-tab ${activePage === 2 ? "active" : ""}`}
            onClick={() => setActivePage(2)}
          >
            Page 2: Driver Copy
          </button>
          <button
            className={`almarai-page-tab ${activePage === 3 ? "active" : ""}`}
            onClick={() => setActivePage(3)}
          >
            Page 3: Road Safety ({WAYBILL_UI_LABELS.roadSafetyTab})
          </button>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button className="btn-action" onClick={handlePrint} style={{ background: "#0F172A", color: "#FFFFFF", border: "none" }}>
            🖨️ Print / Save PDF
          </button>
          {showPumpAction && onAuthorizePump && (
            <button className="btn-action auto-demo" onClick={onAuthorizePump}>
              ⚡ Authorize & Pump at Bay 1
            </button>
          )}
          {onClose && (
            <button className="btn-action" onClick={onClose}>
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {/* Document Sheet (Styled for true A4 print & screen) */}
      <div className="almarai-a4-sheet-wrapper">
        {/* PAGE 1 OR PAGE 2 (OFFICE / DRIVER COPY) */}
        {(activePage === 1 || activePage === 2) && (
          <div className="almarai-doc-page">
            {/* Top Almarai Brand Header */}
            <div className="almarai-brand-header">
              <div className="almarai-waybill-title-block">
                <div className="almarai-main-title">Waybill</div>
                <div className="almarai-title-blue-bar" />
              </div>

              {/* Barcode Strip */}
              <div className="almarai-barcode-container">
                <div className="almarai-barcode-lines">
                  <svg width="220" height="42" viewBox="0 0 220 42">
                    {/* Authentic Code 128 barcode simulation */}
                    <rect x="0" y="0" width="3" height="40" fill="#000"/>
                    <rect x="5" y="0" width="2" height="40" fill="#000"/>
                    <rect x="10" y="0" width="4" height="40" fill="#000"/>
                    <rect x="16" y="0" width="1" height="40" fill="#000"/>
                    <rect x="20" y="0" width="3" height="40" fill="#000"/>
                    <rect x="25" y="0" width="5" height="40" fill="#000"/>
                    <rect x="33" y="0" width="2" height="40" fill="#000"/>
                    <rect x="38" y="0" width="4" height="40" fill="#000"/>
                    <rect x="45" y="0" width="2" height="40" fill="#000"/>
                    <rect x="50" y="0" width="3" height="40" fill="#000"/>
                    <rect x="56" y="0" width="4" height="40" fill="#000"/>
                    <rect x="63" y="0" width="2" height="40" fill="#000"/>
                    <rect x="68" y="0" width="5" height="40" fill="#000"/>
                    <rect x="76" y="0" width="2" height="40" fill="#000"/>
                    <rect x="81" y="0" width="3" height="40" fill="#000"/>
                    <rect x="87" y="0" width="4" height="40" fill="#000"/>
                    <rect x="94" y="0" width="2" height="40" fill="#000"/>
                    <rect x="99" y="0" width="3" height="40" fill="#000"/>
                    <rect x="105" y="0" width="5" height="40" fill="#000"/>
                    <rect x="113" y="0" width="2" height="40" fill="#000"/>
                    <rect x="118" y="0" width="4" height="40" fill="#000"/>
                    <rect x="125" y="0" width="3" height="40" fill="#000"/>
                    <rect x="131" y="0" width="2" height="40" fill="#000"/>
                    <rect x="136" y="0" width="4" height="40" fill="#000"/>
                    <rect x="143" y="0" width="3" height="40" fill="#000"/>
                    <rect x="149" y="0" width="5" height="40" fill="#000"/>
                    <rect x="157" y="0" width="2" height="40" fill="#000"/>
                    <rect x="162" y="0" width="4" height="40" fill="#000"/>
                    <rect x="169" y="0" width="2" height="40" fill="#000"/>
                    <rect x="174" y="0" width="3" height="40" fill="#000"/>
                    <rect x="180" y="0" width="4" height="40" fill="#000"/>
                    <rect x="187" y="0" width="3" height="40" fill="#000"/>
                    <rect x="193" y="0" width="2" height="40" fill="#000"/>
                    <rect x="198" y="0" width="5" height="40" fill="#000"/>
                    <rect x="206" y="0" width="2" height="40" fill="#000"/>
                    <rect x="211" y="0" width="4" height="40" fill="#000"/>
                    <rect x="218" y="0" width="2" height="40" fill="#000"/>
                  </svg>
                </div>
                <div className="almarai-barcode-text">Waybill No. {waybillNo}</div>
              </div>

              {/* Logo & Meta */}
              <div className="almarai-logo-meta-block">
                <div className="almarai-logo-img">
                  <div style={{ fontSize: "19px", fontWeight: 900, color: "#005596", lineHeight: 1.1 }}>المراعي</div>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: "#005596", letterSpacing: ".05em" }}>Almarai</div>
                </div>
                <div className="almarai-print-meta">
                  <div>Page Number : Page {activePage} of 3</div>
                  <div>Printed on : {preparedDate}</div>
                </div>
              </div>
            </div>

            {/* Header Grey Bar */}
            <div className="almarai-header-bar">
              <div style={{ fontWeight: 800 }}>Waybill No. : {waybillNo}</div>
              <div style={{ fontWeight: 800 }}>{activePage === 1 ? "1 OFFICE COPY" : "2 DRIVER COPY"}</div>
            </div>

            {/* Main Key-Value Metadata Grid */}
            <table className="almarai-meta-table">
              <tbody>
                <tr>
                  <td className="lbl">Prepared Date &amp; Time :</td>
                  <td className="val">{preparedDate}</td>
                  <td className="lbl">Schedule Date &amp; Time :</td>
                  <td className="val">{scheduleDate}</td>
                </tr>
                <tr>
                  <td className="lbl">Prepared By :</td>
                  <td className="val">{preparedBy}</td>
                  <td className="lbl">Final Destination :</td>
                  <td className="val" style={{ fontWeight: 800 }}>{finalDestination}</td>
                </tr>
                <tr>
                  <td className="lbl">TRIP :</td>
                  <td className="val" style={{ fontWeight: 700 }}>{tripCustomer}</td>
                  <td className="lbl">Driver :</td>
                  <td className="val" style={{ fontWeight: 800 }}>{driverName}</td>
                </tr>
                <tr>
                  <td className="lbl">Arabic Desc :</td>
                  <td className="val" style={{ direction: "rtl", fontFamily: "Tahoma, Arial, sans-serif" }}>{arabicDesc}</td>
                  <td className="lbl">Additional Driver :</td>
                  <td className="val" />
                </tr>
                <tr>
                  <td className="lbl">Tractor No :</td>
                  <td className="val" style={{ fontWeight: 800 }}>{tractorNo}</td>
                  <td className="lbl">Additional Driver :</td>
                  <td className="val" />
                </tr>
                <tr>
                  <td className="lbl">Trailer No :</td>
                  <td className="val">{trailerNo}</td>
                  <td className="lbl">Trainee Driver :</td>
                  <td className="val" />
                </tr>
              </tbody>
            </table>

            {/* Multi-Leg Trip Schedule Table */}
            <table className="almarai-schedule-table">
              <thead>
                <tr>
                  <th rowSpan={2} style={{ width: "26%" }}>Trip Locations<br/><span style={{ fontWeight: 400, fontSize: "9px" }}>Destination</span></th>
                  <th colSpan={2} style={{ textAlign: "center" }}>Departure</th>
                  <th colSpan={2} style={{ textAlign: "center" }}>Arrival</th>
                  <th rowSpan={2} style={{ width: "9%" }}>Delay Depart Reason</th>
                  <th rowSpan={2} style={{ width: "9%" }}>Delay Arrival Reason</th>
                  <th rowSpan={2} style={{ width: "9%" }}>CPP Arrival Delay Reason</th>
                </tr>
                <tr>
                  <th style={{ width: "13%" }}>Scheduled</th>
                  <th style={{ width: "10%" }}>Actual</th>
                  <th style={{ width: "13%" }}>Scheduled</th>
                  <th style={{ width: "10%" }}>Actual</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700 }}>CPP - RIYADH SOUTH DEPOT</td>
                  <td>13.08.2026 00:00</td>
                  <td />
                  <td>13.08.2026 02:00</td>
                  <td />
                  <td /><td /><td />
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>RIYADH SOUTH DEPOT - CUSTOMER (RIYADH)</td>
                  <td>13.08.2026 03:30</td>
                  <td />
                  <td>13.08.2026 04:30</td>
                  <td />
                  <td /><td /><td />
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>CUSTOMER (RIYADH) - CPP</td>
                  <td>13.08.2026 06:30</td>
                  <td />
                  <td>13.08.2026 09:30</td>
                  <td />
                  <td /><td /><td />
                </tr>
              </tbody>
            </table>

            {/* Warehouse Location & Bay Refill Details */}
            <table className="almarai-warehouse-table">
              <thead>
                <tr>
                  <th style={{ width: "18%" }}>Warehouse Location<br/><span style={{ fontFamily: "Tahoma" }}>{WAYBILL_UI_LABELS.warehouseLocation}</span></th>
                  <th style={{ width: "12%" }}>Bay Number<br/><span style={{ fontFamily: "Tahoma" }}>{WAYBILL_UI_LABELS.bayNumber}</span></th>
                  <th style={{ width: "20%" }}>Scheduled Loading<br/>Start Date &amp; Time<br/><span style={{ fontFamily: "Tahoma" }}>{WAYBILL_UI_LABELS.loadingStart}</span></th>
                  <th style={{ width: "20%" }}>Scheduled Loading<br/>End Date &amp; Time<br/><span style={{ fontFamily: "Tahoma" }}>{WAYBILL_UI_LABELS.loadingEnd}</span></th>
                  <th style={{ width: "15%" }}>Temperature</th>
                  <th style={{ width: "15%" }}>Factory<br/>Seal Number</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700 }}>ASRS Warehouse 200 / Kharj Forecourt</td>
                  <td style={{ fontWeight: 800, textAlign: "center" }}>{bayNo}</td>
                  <td>12.08.2026 22:00</td>
                  <td>12.08.2026 23:00</td>
                  <td style={{ fontWeight: 700, textAlign: "center" }}>CMP1 : {tempC}</td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={3} style={{ borderRight: "1px solid #94A3B8" }}>
                    <b>Depot Seal Number 1</b>
                  </td>
                  <td colSpan={3}>
                    <b>Depot Seal Number 2</b>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Dotted Extension Area */}
            <div className="almarai-extension-section">
              <div className="almarai-ext-title">Write Trip Extension below</div>
              <div className="almarai-dotted-line" />
              <div className="almarai-dotted-line" />
              <div className="almarai-dotted-line" />
              <div className="almarai-dotted-line" />
              <div className="almarai-dotted-line" />
            </div>

            {/* Financial Cash Advance */}
            <div className="almarai-financial-row">
              <div><b>Gulf Trip Cash Advance in SAR :</b> &nbsp; 0</div>
              <div style={{ fontSize: "9px", fontFamily: "Tahoma" }}>جميع السلع مضمونة في المملكة العربية السعودية</div>
            </div>

            {/* Driver Message & Emergency Safety Contacts */}
            <div className="almarai-safety-alert-box">
              <div style={{ fontWeight: 800, color: "#000", marginBottom: "2px" }}>
                Driver Message :
              </div>
              <div>
                STOP &amp; THINK. SAFETY COMES FIRST. FOR ANY ACCIDENT RELATED CALL NAJM CONTACT NUMBER: <b>9200005506502</b> or TO TRANSPORT DISPATCH OFFICE: <b>0115499599 extension 2570</b> or MOB: <b>0505 279 708</b>.
              </div>
              <div style={{ marginTop: "2px", fontSize: "9px" }}>
                Pl. don't bypass weigh bridge station without entering and follow the procedures as the mandate of the state of KSA and any fine related to this will be charged to the driver, and he must complete the full payment before he is allowed to go on vacation.
              </div>
            </div>

            {/* Signatures & Remarks */}
            <div className="almarai-sign-row">
              <div><b>Closed By :</b> _____________________</div>
              <div><b>Signature :</b> _____________________</div>
            </div>

            <div className="almarai-remark-row">
              <b>Remark :</b> &nbsp; {remark}
            </div>

            {/* Official Legal Footer */}
            <div className="almarai-legal-footer">
              Almarai Company, P.O. Box 8524 Riyadh 11492, Kingdom of Saudi Arabia - www.almarai.com - Tel: +966(1)4700005 - Fax: +966(1)4701555
            </div>
          </div>
        )}

        {/* PAGE 3: SAFETY ON THE ROAD (بق أمنا بالطريق) */}
        {activePage === 3 && (
          <div className="almarai-doc-page almarai-safety-page">
            {/* Safety Header */}
            <div className="almarai-safety-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ fontSize: "24px", fontWeight: 900, color: "#005596" }}>المراعي<br/><span style={{ fontSize: "20px" }}>Almarai</span></div>
                <div style={{ fontSize: "13px", color: "#1E3A8A", fontWeight: 600, borderLeft: "2px solid #005596", paddingLeft: "10px" }}>
                  Your safety is our priority. Drive smart. Drive safe. Return alive. Family needs You<br/>
                  <span style={{ fontSize: "12px", fontFamily: "Tahoma", direction: "rtl" }}>{WAYBILL_UI_LABELS.safetyMotto}</span>
                </div>
              </div>
              <div className="almarai-safety-badge-title">
                STAY SAFE ON THE ROAD<br/>
                <span style={{ fontSize: "16px", fontFamily: "Tahoma" }}>{WAYBILL_UI_LABELS.staySafeHeading}</span>
              </div>
            </div>

            {/* Safety Rules Checklist Grid */}
            <div className="almarai-safety-grid">
              {/* Rule 1 */}
              <div className="safety-rule-card">
                <div className="safety-rule-icon">📋</div>
                <div className="safety-rule-content">
                  <div className="en">Check brakes, tires, lights, ABS cable and reefer seal</div>
                  <div className="ar">تأكد من سلامة الفرامل، الإطارات، الأنوار، كيبل نظام الفرامل الإلكتروني، وختم البراد قبل الانطلاق</div>
                  <div className="hi">ब्रेक, टायर, लाइट, ABS केबल और रीफर सील की जांच करें</div>
                </div>
              </div>

              {/* Rule 2 */}
              <div className="safety-rule-card">
                <div className="safety-rule-icon">🚚</div>
                <div className="safety-rule-content">
                  <div className="en">Avoid parking in soft sand, always park on firm &amp; stable ground. Don't get stuck!</div>
                  <div className="ar">تجنب الوقوف على الرمال، واحرص دائما على التوقف فوق أرضية صلبة وثابتة لتفادي انغراز الشاحنة وصعوبة إخراجها</div>
                  <div className="hi">नरम रेत पर गाड़ी पार्क करने से बचें, हमेशा ठोस और स्थिर जमीन पर ही गाड़ी पार्क करें। फंसें नहीं!</div>
                </div>
              </div>

              {/* Rule 3 */}
              <div className="safety-rule-card">
                <div className="safety-rule-icon">⚠️</div>
                <div className="safety-rule-content">
                  <div className="en">Drive safely &amp; avoid distractions. Stay focused. Distractions can lead to rollovers</div>
                  <div className="ar">قد بحذر، وابق متنبها طوال الوقت؛ فالتشتت أثناء القيادة قد يتسبب في حوادث خطيرة أو انقلاب المركبة</div>
                  <div className="hi">सुरक्षित ड्राइविंग करें और ध्यान भटकाने वाली चीज़ों से बचें। ध्यान केंद्रित रखें। ध्यान भटकने से गाड़ी पलट सकती है।</div>
                </div>
              </div>

              {/* Rule 4 */}
              <div className="safety-rule-card">
                <div className="safety-rule-icon">⏱️</div>
                <div className="safety-rule-content">
                  <div className="en">Obey speed limits &amp; keep safe following distance. Being late &amp; in a hurry can lead to crashes</div>
                  <div className="ar">التزم بالسرعة النظامية واحتفظ بمسافة أمان كافية؛ التسرع بسبب التأخير قد يؤدي إلى التصادم</div>
                  <div className="hi">गति सीमा का पालन करें और सुरक्षित दूरी बनाए रखें। देर से पहुंचने और जल्दबाजी में होने से दुर्घटनाएं हो सकती हैं।</div>
                </div>
              </div>

              {/* Rule 5 */}
              <div className="safety-rule-card">
                <div className="safety-rule-icon">📵</div>
                <div className="safety-rule-content">
                  <div className="en">Avoid phone use, eating, smoking and other distractions while driving</div>
                  <div className="ar">لا تستخدم الهاتف، ولا تأكل أو تدخن أو تنشغل بأي أمر آخر أثناء القيادة</div>
                  <div className="hi">वाहन चलाते समय फोन का उपयोग, भोजन, धूम्रपान और अन्य ध्यान भटकाने वाली चीजों से बचें</div>
                </div>
              </div>

              {/* Rule 6 */}
              <div className="safety-rule-card">
                <div className="safety-rule-icon">😴</div>
                <div className="safety-rule-content">
                  <div className="en">Get enough rest at least 7 hrs. prior to trip and take regular breaks, every four hours stop and rest.</div>
                  <div className="ar">احصل على قسط كاف من النوم لا يقل عن 7 ساعات قبل الرحلة، وخذ استراحة كل 4 ساعات لتجنب الإرهاق</div>
                  <div className="hi">यात्रा से कम से कम 7 घंटे पहले पर्याप्त आराम करें और नियमित ब्रेक लें, हर चार घंटे में रुकें और आराम करें।</div>
                </div>
              </div>

              {/* Rule 7 */}
              <div className="safety-rule-card">
                <div className="safety-rule-icon">🌧️</div>
                <div className="safety-rule-content">
                  <div className="en">Adjust speed and following distance in unfavorable weather</div>
                  <div className="ar">في الأجواء السيئة، خفف السرعة وزد مسافة الأمان بينك وبين المركبات الأخرى</div>
                  <div className="hi">प्रतिकूल मौसम में गति और दूरी समायोजित करें</div>
                </div>
              </div>

              {/* Rule 8 */}
              <div className="safety-rule-card">
                <div className="safety-rule-icon">🛡️</div>
                <div className="safety-rule-content">
                  <div className="en">Put your seat belt on and drive defensively, observe and be prepared for the actions of other drivers</div>
                  <div className="ar">استخدم حزام الأمان دائماً، وقد بأسلوب دفاعي، وكن مستعداً لتصرفات الآخرين على الطريق</div>
                  <div className="hi">अपनी सीट बेल्ट बांधें और रक्षात्मक तरीके से गाड़ी चलाएं, अन्य ड्राइवरों की गतिविधियों पर नजर रखें और उनके लिए तैयार रहें</div>
                </div>
              </div>
            </div>

            {/* Official Legal Footer */}
            <div className="almarai-legal-footer" style={{ marginTop: "auto" }}>
              Almarai Company, P.O. Box 8524 Riyadh 11492, Kingdom of Saudi Arabia - www.almarai.com - Tel: +966(1)4700005 - Fax: +966(1)4701555
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
