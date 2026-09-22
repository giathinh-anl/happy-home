/* ============================================================
   Happy Home — Hình minh họa dùng chung (web quản trị + app khách thuê)
   HH.pic('receipt', 28)  -> icon tượng hình nhiều màu, có khối sáng tối
   HH.scene()             -> tranh khu phố làm ảnh nền (SVG nội tuyến,
                             mây trôi, cửa sổ nhấp nháy; tự đứng yên khi
                             máy bật "giảm chuyển động")
   Cả hai trả về đối tượng dùng được trong h`` lẫn chuỗi thường.
   ============================================================ */
HH.art = (function () {
  // Màu minh họa: [phía sáng, phía tối] -> đổ dốc từ trên xuống cho cảm giác khối
  const C = {
    teal:  ['#3CC6B8', '#0F7A74'],
    sea:   ['#23958E', '#0B5654'],
    sun:   ['#FFD970', '#F2A224'],
    coral: ['#FFA37F', '#E9573B'],
    sky:   ['#84CFFF', '#2D7FDC'],
    grape: ['#C4A9FF', '#7858E0'],
    leaf:  ['#92E2A5', '#2DA05D'],
    wood:  ['#F3C48F', '#C2824A'],
    skin:  ['#FFDDB8', '#EAA673'],
    paper: ['#FFFFFF', '#E3EDEB'],
  };

  const W = (o) => `fill="#fff" opacity="${o}"`;          // mảng sáng
  const LINE = '#C9D7D4';                                   // dòng chữ giả trên giấy
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315]
    .map(a => `<rect x="20.5" y="3.2" width="7" height="9" rx="2.2" transform="rotate(${a} 24 24)"/>`).join('');

  /* Mỗi hình vẽ trong ô 48x48. {tên} = dải màu ở bảng C. */
  const P = {
    house: `<rect x="30" y="8" width="5.6" height="10" rx="1.3" fill="#D8563A"/>
      <rect x="9.5" y="20" width="29" height="22.5" rx="3.6" fill="{teal}"/>
      <path d="M24 5.2c.9 0 1.8.3 2.5.9l15 12.9c1.5 1.3.6 3.8-1.4 3.8H7.9c-2 0-2.9-2.5-1.4-3.8l15-12.9c.7-.6 1.6-.9 2.5-.9z" fill="{coral}"/>
      <rect x="13" y="25.5" width="6" height="6" rx="1.4" fill="#FFF1C9"/>
      <rect x="29" y="25.5" width="6" height="6" rx="1.4" fill="#FFF1C9"/>
      <rect x="20" y="29.5" width="8" height="13" rx="2" fill="{wood}"/>
      <circle cx="25.8" cy="36.3" r="1" fill="#7A4A20"/>
      <rect x="11.6" y="23" width="2.2" height="16.5" rx="1.1" ${W(.28)}/>`,

    building: `<rect x="23.5" y="5" width="18" height="38" rx="3.2" fill="{sky}"/>
      <rect x="7" y="13" width="20" height="30" rx="3.2" fill="{teal}"/>
      <g fill="#FFF1C9"><rect x="11" y="18" width="4.4" height="4.4" rx="1"/><rect x="18.6" y="18" width="4.4" height="4.4" rx="1"/>
      <rect x="11" y="25.5" width="4.4" height="4.4" rx="1"/><rect x="18.6" y="25.5" width="4.4" height="4.4" rx="1"/></g>
      <g ${W(.75)}><rect x="28" y="10" width="3.6" height="4" rx=".9"/><rect x="34" y="10" width="3.6" height="4" rx=".9"/>
      <rect x="28" y="17.5" width="3.6" height="4" rx=".9"/><rect x="34" y="17.5" width="3.6" height="4" rx=".9"/>
      <rect x="28" y="25" width="3.6" height="4" rx=".9"/><rect x="34" y="25" width="3.6" height="4" rx=".9"/>
      <rect x="28" y="32.5" width="3.6" height="4" rx=".9"/><rect x="34" y="32.5" width="3.6" height="4" rx=".9"/></g>
      <rect x="14" y="34" width="6" height="9" rx="1.2" fill="{wood}"/>
      <rect x="4" y="42" width="40" height="3" rx="1.5" fill="#0B5654" opacity=".2"/>`,

    chart: `<rect x="5" y="6" width="38" height="36" rx="8.5" fill="{paper}" stroke="#D2DFDC"/>
      <rect x="11" y="26" width="6.5" height="10" rx="2" fill="{sky}"/>
      <rect x="20.75" y="19.5" width="6.5" height="16.5" rx="2" fill="{grape}"/>
      <rect x="30.5" y="14" width="6.5" height="22" rx="2" fill="{teal}"/>
      <path d="M10 21.5 19 15l6 3.4 11.2-7.9M31.6 10.3l4.9.1-.2 4.9" fill="none" stroke="#EC6444" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,

    card: `<rect x="11" y="6.5" width="31" height="20.5" rx="4" fill="{grape}" transform="rotate(-9 26.5 16.75)"/>
      <rect x="5" y="15" width="34" height="23" rx="4.6" fill="{teal}"/>
      <rect x="5" y="20.5" width="34" height="5" fill="#0A4A47" opacity=".5"/>
      <rect x="9.5" y="29.5" width="8" height="5.5" rx="1.6" fill="{sun}"/>
      <rect x="20" y="31" width="9" height="2.4" rx="1.2" ${W(.55)}/>
      <circle cx="37" cy="36" r="8" fill="{sun}"/>
      <circle cx="37" cy="36" r="5.2" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.4"/>
      <path d="M37 32.8v6.4" stroke="#B0680F" stroke-width="2" stroke-linecap="round"/>`,

    megaphone: `<rect x="5" y="17" width="8" height="13" rx="3" fill="{wood}"/>
      <path d="M13.8 28.6 16.9 38c.4 1.2 1.7 1.8 2.9 1.4l1.6-.6c1.2-.4 1.8-1.7 1.3-2.9l-2.9-7z" fill="#2C3E3C"/>
      <path d="M10.5 18.3 29 9.9c1.6-.7 3.3.5 3.3 2.2v22.8c0 1.7-1.7 2.9-3.3 2.2l-18.5-8.4z" fill="{coral}"/>
      <ellipse cx="32" cy="23.5" rx="3" ry="12" fill="#FFD3C3"/>
      <path d="M13.5 20.5 27 14.3" stroke="#fff" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>
      <path d="M38.8 17.5c1.8 1.6 2.8 3.6 2.8 6s-1 4.4-2.8 6M40.4 11.3l3.2-2.3M40.4 35.7l3.2 2.3" fill="none" stroke="#F2A224" stroke-width="2.6" stroke-linecap="round"/>`,

    users: `<circle cx="32" cy="15" r="6.2" fill="{skin}"/>
      <path d="M25.9 14.3c.3-3.6 3-6.3 6.2-6.3 3.3 0 5.9 2.6 6.2 6-2.4-.2-4.6-1.3-6-3.1-1.5 2-3.8 3.2-6.4 3.4z" fill="#6B4A2E"/>
      <path d="M21 39c0-6.4 4.9-11.5 11-11.5S43 32.6 43 39v1.5H21z" fill="{grape}"/>
      <circle cx="18" cy="18.5" r="7.2" fill="{skin}"/>
      <path d="M10.8 17.7c.2-4.3 3.4-7.7 7.3-7.7s7.1 3.4 7.3 7.7c-2.8-.3-5.3-1.6-7-3.7-1.7 2.2-4.5 3.5-7.6 3.7z" fill="#3B2A1E"/>
      <path d="M5 42c0-7.5 5.8-13.5 13-13.5S31 34.5 31 42v1.5H5z" fill="{teal}"/>
      <path d="M9.2 38.4c.6-3.2 2.5-5.9 5.1-7.3" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="2" stroke-linecap="round"/>`,

    user: `<circle cx="24" cy="15.5" r="8.5" fill="{skin}"/>
      <path d="M15.4 14.6c.3-5 4-8.8 8.6-8.8s8.3 3.8 8.6 8.8c-3.3-.3-6.2-1.8-8.2-4.1-2 2.5-5.3 3.9-9 4.1z" fill="#3B2A1E"/>
      <path d="M8 42.5c0-8.8 7.2-16 16-16s16 7.2 16 16v1H8z" fill="{teal}"/>
      <path d="M20 30.8 24 35l4-4.2" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,

    gear: `<g fill="#3787E0">${teeth}</g>
      <circle cx="24" cy="24" r="14" fill="{sky}"/>
      <circle cx="24" cy="24" r="5.6" fill="#fff"/>
      <path d="M14.4 20.2a10.5 10.5 0 0 1 5.8-5.9" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.2" stroke-linecap="round"/>`,

    bell: `<circle cx="24" cy="6.8" r="2.8" fill="#F2A224"/>
      <path d="M24 8c-6.5 0-11 5-11 11.4v6.8l-3.3 4.9c-.9 1.4.1 3.2 1.7 3.2h25.2c1.6 0 2.6-1.8 1.7-3.2L35 26.2v-6.8C35 13 30.5 8 24 8z" fill="{sun}"/>
      <circle cx="24" cy="38.6" r="4.2" fill="{coral}"/>
      <path d="M17.3 19.2c.2-3.3 2-5.9 4.8-7" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M39.6 9.6c2 1.6 3.3 3.8 3.7 6.4M8.4 9.6c-2 1.6-3.3 3.8-3.7 6.4" fill="none" stroke="#E9573B" stroke-width="2.2" stroke-linecap="round"/>`,

    door: `<rect x="9" y="4" width="30" height="40" rx="5" fill="{wood}"/>
      <rect x="13.5" y="8.5" width="21" height="35.5" rx="2.6" fill="{teal}"/>
      <rect x="17" y="12" width="14" height="10" rx="1.6" ${W(.22)}/>
      <rect x="17" y="25" width="14" height="14.5" rx="1.6" ${W(.22)}/>
      <circle cx="30.4" cy="27.5" r="2" fill="{sun}"/>
      <rect x="5" y="42.5" width="38" height="3.4" rx="1.7" fill="#0B5654" opacity=".2"/>`,

    receipt: `<path d="M9 7.5C9 6.1 10.1 5 11.5 5h25C37.9 5 39 6.1 39 7.5V43l-3.75-2.4L31.5 43l-3.75-2.4L24 43l-3.75-2.4L16.5 43l-3.75-2.4L9 43z" fill="{paper}" stroke="#CEDCD9"/>
      <rect x="14" y="11" width="13" height="3.2" rx="1.6" fill="{sky}"/>
      <rect x="14" y="18" width="20" height="2.4" rx="1.2" fill="${LINE}"/>
      <rect x="14" y="23.5" width="16" height="2.4" rx="1.2" fill="${LINE}"/>
      <rect x="14" y="30" width="12" height="4.6" rx="2.3" fill="{teal}"/>
      <circle cx="36" cy="36" r="8.5" fill="{leaf}"/>
      <path d="M32.1 36.1l2.6 2.6 5.2-5.3" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,

    concierge: `<circle cx="24" cy="12" r="3" fill="{coral}"/>
      <rect x="22.2" y="14" width="3.6" height="6" rx="1.2" fill="#F2A224"/>
      <path d="M8.5 35.5c0-8.6 6.9-15.5 15.5-15.5s15.5 6.9 15.5 15.5z" fill="{sun}"/>
      <rect x="5.5" y="35" width="37" height="5.5" rx="2.75" fill="{wood}"/>
      <path d="M13.6 31.5c.8-4.7 4.1-8.4 8.4-9.6" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M39 6.5l1.1 2.8 2.8 1.1-2.8 1.1L39 14.3l-1.1-2.8-2.8-1.1 2.8-1.1z" fill="{grape}"/>`,

    contract: `<path d="M12 4.5h17.5L39 14v27.5c0 1.7-1.3 3-3 3H12c-1.7 0-3-1.3-3-3v-34c0-1.7 1.3-3 3-3z" fill="{paper}" stroke="#CEDCD9"/>
      <path d="M29.5 4.5V11c0 1.7 1.3 3 3 3H39z" fill="#D5E2DF"/>
      <rect x="14" y="16.5" width="11" height="3" rx="1.5" fill="{grape}"/>
      <rect x="14" y="22.5" width="19" height="2.3" rx="1.15" fill="${LINE}"/>
      <rect x="14" y="27.5" width="14" height="2.3" rx="1.15" fill="${LINE}"/>
      <path d="M14 37.5c1.8-3 3.3-3.2 4.2-.8.8 2.2 2.3 2.2 4.2-.9" fill="none" stroke="#2D7FDC" stroke-width="2" stroke-linecap="round"/>
      <g transform="rotate(45 36 33)"><rect x="33.6" y="21" width="4.8" height="18" rx="1.6" fill="{coral}"/>
        <path d="M33.6 39h4.8L36 43.5z" fill="#5A3B22"/><rect x="33.6" y="21" width="4.8" height="3.4" rx="1.2" fill="#FFD3C3"/></g>`,

    sofa: `<rect x="9" y="12" width="30" height="17" rx="5.5" fill="{grape}"/>
      <rect x="26" y="16.5" width="9" height="8" rx="2.5" fill="{sun}" transform="rotate(-10 30.5 20.5)"/>
      <rect x="8" y="25" width="32" height="10" rx="3.5" fill="#B49BFF"/>
      <rect x="3.5" y="20" width="9" height="17" rx="4.5" fill="#7858E0"/>
      <rect x="35.5" y="20" width="9" height="17" rx="4.5" fill="#7858E0"/>
      <rect x="8" y="37" width="3.2" height="5" rx="1.2" fill="#A86B36"/>
      <rect x="36.8" y="37" width="3.2" height="5" rx="1.2" fill="#A86B36"/>
      <rect x="13" y="15.5" width="10" height="3" rx="1.5" ${W(.32)}/>
      <rect x="5.5" y="22.5" width="2.2" height="8" rx="1.1" ${W(.3)}/>`,

    meter: `<rect x="7" y="9" width="34" height="33" rx="9" fill="{sky}"/>
      <circle cx="24" cy="26.5" r="11.5" fill="#fff"/>
      <path d="M15.6 31a9 9 0 1 1 16.8 0" fill="none" stroke="#F2A224" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="3 3.2"/>
      <path d="M24 26.5l5.5-6" stroke="#E9573B" stroke-width="2.8" stroke-linecap="round"/>
      <circle cx="24" cy="26.5" r="2.4" fill="#2C3E3C"/>
      <rect x="10" y="12.5" width="2.4" height="11" rx="1.2" ${W(.35)}/>
      <path d="M36.5 2.5 31 10.5h4.5L33 17.5l7.5-9.2H36l2.5-5.8z" fill="{sun}" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>`,

    wallet: `<rect x="12" y="6" width="25" height="15" rx="2.5" fill="{leaf}" transform="rotate(-10 24.5 13.5)"/>
      <circle cx="24.5" cy="13.2" r="3" ${W(.5)}/>
      <rect x="5" y="14" width="36" height="28" rx="6.5" fill="{wood}"/>
      <rect x="28" y="22.5" width="16" height="11.5" rx="4" fill="#A86B36"/>
      <circle cx="33.5" cy="28.25" r="2.3" fill="{sun}"/>
      <path d="M9.5 19.5h15" stroke="#fff" stroke-opacity=".5" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="2.2 2.4"/>`,

    wrench: `<g transform="rotate(45 24 24)">
        <path d="M20.5 3.7A9 9 0 1 0 27.5 3.7V10c0 .8-.7 1.5-1.5 1.5h-4c-.8 0-1.5-.7-1.5-1.5z" fill="{sky}"/>
        <rect x="20.5" y="18" width="7" height="27" rx="3.5" fill="{sky}"/>
        <rect x="22.4" y="24" width="3.2" height="15" rx="1.6" ${W(.35)}/></g>
      <path d="M37 30.5l5.6 3.25v6.5L37 43.5l-5.6-3.25v-6.5z" fill="{sun}"/>
      <circle cx="37" cy="37" r="2.4" fill="#fff"/>`,

    coins: `<rect x="7" y="22" width="22" height="15" fill="#F2A33A"/>
      <ellipse cx="18" cy="37" rx="11" ry="4.5" fill="#DE8A1C"/>
      <path d="M7 27c0 2.5 4.9 4.5 11 4.5s11-2 11-4.5M7 32c0 2.5 4.9 4.5 11 4.5s11-2 11-4.5" fill="none" stroke="#FFE39D" stroke-width="1.3"/>
      <ellipse cx="18" cy="22" rx="11" ry="4.5" fill="{sun}"/>
      <ellipse cx="18" cy="22" rx="6" ry="2.2" ${W(.45)}/>
      <path d="M37.5 5.5l6.5 7.5h-4v7h-5v-7h-4z" fill="{leaf}"/>
      <path d="M37.5 43l-6.5-7.5h4v-7h5v7h4z" fill="{coral}"/>`,

    lock: `<path d="M16 21v-5.5a8 8 0 0 1 16 0V21" fill="none" stroke="#5D7472" stroke-width="4.6" stroke-linecap="round"/>
      <rect x="9.5" y="19.5" width="29" height="24" rx="6.5" fill="{teal}"/>
      <g ${W(.9)}><circle cx="18" cy="27.5" r="1.9"/><circle cx="24" cy="27.5" r="1.9"/><circle cx="30" cy="27.5" r="1.9"/>
      <circle cx="18" cy="34" r="1.9"/><circle cx="24" cy="34" r="1.9"/><circle cx="30" cy="34" r="1.9"/></g>
      <path d="M37 7a7 7 0 0 1 4.9 4.9M37.4 2.6a11 11 0 0 1 8.2 8.2" fill="none" stroke="#2D7FDC" stroke-width="2.2" stroke-linecap="round"/>`,

    sliders: `<rect x="5" y="7" width="38" height="34" rx="8.5" fill="{grape}"/>
      <g ${W(.45)}><rect x="11" y="14.5" width="26" height="2.8" rx="1.4"/><rect x="11" y="22.6" width="26" height="2.8" rx="1.4"/><rect x="11" y="30.7" width="26" height="2.8" rx="1.4"/></g>
      <circle cx="17" cy="15.9" r="4" fill="{sun}" stroke="#fff" stroke-width="1.6"/>
      <circle cx="31" cy="24" r="4" fill="{leaf}" stroke="#fff" stroke-width="1.6"/>
      <circle cx="22" cy="32.1" r="4" fill="{coral}" stroke="#fff" stroke-width="1.6"/>`,

    bolt: `<path d="M28 3.5 9.5 27.5h12L18.5 44.5 39 19.5H27z" fill="{sun}" stroke="#F2A224" stroke-linejoin="round"/>
      <path d="M24.8 9.8 15.2 22.6" stroke="#fff" stroke-opacity=".65" stroke-width="2" stroke-linecap="round"/>`,

    drop: `<path d="M24 4.5c6.3 7.6 13.5 15.4 13.5 24a13.5 13.5 0 0 1-27 0c0-8.6 7.2-16.4 13.5-24z" fill="{sky}"/>
      <path d="M16.5 30c.2 3.8 2.8 6.8 6.2 7.5" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2.4" stroke-linecap="round"/>`,

    camera: `<path d="M17 13.5l2.4-4c.5-.9 1.5-1.5 2.6-1.5h4c1.1 0 2.1.6 2.6 1.5l2.4 4z" fill="#0B5654"/>
      <rect x="4.5" y="13" width="39" height="28" rx="7" fill="{teal}"/>
      <circle cx="24" cy="27" r="9.5" fill="#fff"/>
      <circle cx="24" cy="27" r="6.3" fill="{sky}"/>
      <circle cx="21.8" cy="24.8" r="2" ${W(.85)}/>
      <rect x="33" y="17" width="6" height="3.2" rx="1.6" fill="{sun}"/>
      <rect x="8" y="16.5" width="5" height="2.4" rx="1.2" ${W(.35)}/>`,

    chat: `<rect x="21" y="5" width="23" height="16.5" rx="6" fill="{sun}"/>
      <path d="M10 13.5h20a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H18.5L11 42v-6.5h-1a6 6 0 0 1-6-6v-10a6 6 0 0 1 6-6z" fill="{grape}"/>
      <g fill="#fff"><circle cx="13.5" cy="24.5" r="2.2"/><circle cx="20" cy="24.5" r="2.2"/><circle cx="26.5" cy="24.5" r="2.2"/></g>
      <path d="M40.5 27l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z" fill="{coral}"/>`,

    clipboard: `<rect x="9" y="7" width="30" height="37" rx="5" fill="{wood}"/>
      <rect x="12.5" y="11" width="23" height="30" rx="2.5" fill="#fff"/>
      <rect x="17.5" y="4" width="13" height="7.5" rx="2.8" fill="#5D7472"/>
      <circle cx="17.5" cy="19" r="2.6" fill="{leaf}"/><rect x="22" y="17.8" width="10" height="2.4" rx="1.2" fill="${LINE}"/>
      <circle cx="17.5" cy="26.5" r="2.6" fill="{leaf}"/><rect x="22" y="25.3" width="8" height="2.4" rx="1.2" fill="${LINE}"/>
      <circle cx="17.5" cy="34" r="2.3" fill="none" stroke="${LINE}" stroke-width="1.6"/><rect x="22" y="32.8" width="9" height="2.4" rx="1.2" fill="${LINE}"/>`,

    apps: `<rect x="6" y="6" width="16" height="16" rx="5" fill="{teal}"/>
      <rect x="26" y="6" width="16" height="16" rx="8" fill="{sun}"/>
      <rect x="6" y="26" width="16" height="16" rx="5" fill="{coral}"/>
      <rect x="26" y="26" width="16" height="16" rx="5" fill="{grape}"/>
      <rect x="9" y="9" width="6" height="2.4" rx="1.2" ${W(.5)}/><rect x="9" y="29" width="6" height="2.4" rx="1.2" ${W(.5)}/>`,

    calendar: `<rect x="6" y="9" width="36" height="33" rx="7" fill="{paper}" stroke="#CEDCD9"/>
      <path d="M6 16a7 7 0 0 1 7-7h22a7 7 0 0 1 7 7v3H6z" fill="{coral}"/>
      <rect x="14" y="5" width="4" height="9" rx="2" fill="#2C3E3C"/><rect x="30" y="5" width="4" height="9" rx="2" fill="#2C3E3C"/>
      <g fill="${LINE}"><rect x="12" y="24" width="5" height="4.5" rx="1.2"/><rect x="21.5" y="24" width="5" height="4.5" rx="1.2"/>
      <rect x="12" y="32" width="5" height="4.5" rx="1.2"/><rect x="21.5" y="32" width="5" height="4.5" rx="1.2"/></g>
      <rect x="31" y="24" width="5" height="4.5" rx="1.2" fill="{teal}"/>`,

    alarm: `<path d="M24 5.5 4.3 39.2c-.9 1.6.2 3.6 2.1 3.6h35.2c1.9 0 3-2 2.1-3.6L24 5.5z" fill="{coral}"/>
      <path d="M24 7.8 7.5 37" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>
      <rect x="21.7" y="16" width="4.6" height="14" rx="2.3" fill="#fff"/>
      <circle cx="24" cy="35.5" r="2.7" fill="#fff"/>`,

    phone: `<rect x="12" y="3.5" width="24" height="41" rx="6" fill="{sea}"/>
      <rect x="15" y="9" width="18" height="28" rx="2.5" fill="{sky}"/>
      <rect x="20" y="5.8" width="8" height="1.6" rx=".8" ${W(.5)}/>
      <circle cx="24" cy="40.6" r="1.8" ${W(.6)}/>
      <rect x="18" y="13" width="12" height="3" rx="1.5" ${W(.7)}/><rect x="18" y="19" width="8" height="3" rx="1.5" ${W(.5)}/>`,
  };

  // Tên icon nét cũ -> hình tượng hình tương ứng
  const ALIAS = {
    home: 'house', settings: 'gear', file: 'contract', box: 'sofa', gauge: 'meter',
    sheet: 'chart', track: 'clipboard', bank: 'card', expense: 'coins', config: 'sliders',
    noti: 'bell', history: 'card', grid: 'apps', alert: 'alarm',
  };

  let seq = 0;
  function build(name, size) {
    const key = P[name] ? name : (ALIAS[name] || 'apps');
    const id = 'hp' + (++seq) + '-';
    const used = {};
    const body = P[key].replace(/\{(\w+)\}/g, (m, k) => { used[k] = 1; return `url(#${id}${k})`; });
    // Dải màu nghiêng nhẹ (sáng góc trên trái) -> nhìn có khối như icon 3D
    const defs = Object.keys(used).map(k => `<linearGradient id="${id}${k}" x1="0" y1="0" x2=".35" y2="1">`
      + `<stop offset="0" stop-color="${C[k][0]}"/><stop offset="1" stop-color="${C[k][1]}"/></linearGradient>`).join('');
    const s = size || 28;
    return `<svg class="pic pic-${key}" width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">`
      + `<defs>${defs}</defs>${body}</svg>`;
  }
  function pic(name, size) {
    const svg = build(name, size);
    return { __raw: true, value: svg, toString() { return svg; } };
  }

  /* ---------- Tranh khu phố ----------
     Nhà cửa dồn về bên phải để chữ đặt bên trái vẫn dễ đọc.
     Khung hẹp (điện thoại) tự cắt bớt phần trời bên trái, giữ dãy nhà. */
  let sseq = 0;
  function win(x, y, w, h, lit, cls) {
    return `<rect class="${cls || ''}" x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${lit ? '#FFE9AE' : '#9FD0CB'}"/>`;
  }
  function grid(x0, y0, cols, rows, dx, dy, w, h, litMap, tw) {
    let s = '';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = r * cols + c;
      s += win(x0 + c * dx, y0 + r * dy, w, h, litMap.indexOf(k) > -1, tw && tw.indexOf(k) > -1 ? 'sc-tw' : '');
    }
    return s;
  }
  function tree(x, y, s) {
    s = s || 1;
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-4" y="-6" width="8" height="30" rx="3" fill="#A86B36"/>
      <circle cx="0" cy="-22" r="22" fill="#3DAE6C"/><circle cx="-14" cy="-10" r="15" fill="#34A062"/>
      <circle cx="13" cy="-8" r="16" fill="#2E9459"/><circle cx="-6" cy="-30" r="10" fill="#fff" opacity=".16"/></g>`;
  }
  function cloud(x, y, s, cls) {
    return `<g class="sc-cloud ${cls}" transform="translate(${x} ${y}) scale(${s})" fill="#fff">
      <ellipse cx="46" cy="34" rx="46" ry="15"/><circle cx="30" cy="26" r="17"/><circle cx="56" cy="20" r="22"/><circle cx="76" cy="30" r="12"/></g>`;
  }

  function scene(opt) {
    opt = opt || {};
    const id = 'sc' + (++sseq);
    const svg = `<svg class="scene" viewBox="0 0 1200 360" preserveAspectRatio="${opt.align || 'xMaxYMax'} slice" aria-hidden="true" focusable="false">
      <defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#D3EFE9"/><stop offset=".6" stop-color="#EAF6F1"/><stop offset="1" stop-color="#FBF2E4"/></linearGradient></defs>
      <rect width="1200" height="360" fill="url(#${id}s)"/>
      <circle cx="1030" cy="86" r="80" fill="#FFE2A0" opacity=".4"/>
      <circle cx="1030" cy="86" r="46" fill="#FFD27A"/>
      ${cloud(120, 40, 1, 'c1')}${cloud(430, 110, .7, 'c2')}${cloud(760, 36, .9, 'c3')}${cloud(1080, 150, .55, 'c4')}
      <path d="M470 118l8 6 8-6M500 100l7 5 7-5M520 126l6 4 6-4" fill="none" stroke="#5D7472" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>
      <path d="M0 300c120-30 220-18 330-8s230-30 370-16 280-26 500-8v92H0z" fill="#CBE8DF"/>
      <g fill="#B5DCD3"><rect x="590" y="196" width="56" height="150" rx="4"/><rect x="866" y="150" width="64" height="196" rx="4"/>
        <rect x="1112" y="178" width="70" height="170" rx="4"/><rect x="760" y="214" width="46" height="130" rx="4"/></g>
      <!-- chung cư ngọc -->
      <rect x="640" y="176" width="124" height="170" rx="6" fill="#1D6E6B"/>
      <rect x="632" y="166" width="140" height="14" rx="5" fill="#0F5C5B"/>
      ${grid(656, 194, 3, 3, 36, 34, 20, 22, [0, 2, 4, 7], [4])}
      <rect x="688" y="300" width="28" height="46" rx="4" fill="#C98A50"/>
      <!-- nhà gỗ mái nâu -->
      <rect x="784" y="244" width="130" height="102" rx="4" fill="#FFF6EA"/>
      <rect x="884" y="198" width="16" height="34" rx="3" fill="#A86B36"/>
      <path d="M849 188c3 0 6 1 8.4 3l67 52c5 3.9 2.3 11.9-4 11.9H777.6c-6.3 0-9-8-4-11.9l67-52c2.4-2 5.4-3 8.4-3z" fill="#C98A50"/>
      ${win(800, 266, 28, 24, true)}${win(870, 266, 28, 24, false, 'sc-tw')}
      <rect x="836" y="292" width="26" height="54" rx="4" fill="#1D6E6B"/>
      <circle cx="856" cy="320" r="2.4" fill="#FFD27A"/>
      <!-- tòa cao -->
      <rect x="930" y="118" width="112" height="228" rx="6" fill="#3F8E89"/>
      <rect x="978" y="98" width="4" height="22" fill="#2C3E3C" opacity=".6"/><circle cx="980" cy="96" r="4" fill="#E9573B"/>
      ${grid(946, 136, 3, 5, 30, 36, 18, 20, [1, 3, 5, 6, 10, 12], [6, 10])}
      <rect x="970" y="316" width="32" height="30" rx="4" fill="#0F5C5B"/>
      <!-- nhà trắng mái cam -->
      <rect x="1056" y="256" width="112" height="90" rx="4" fill="#FDFEFE"/>
      <path d="M1112 204c2.7 0 5.3.9 7.4 2.6l58 46c4.5 3.6 2 10.4-3.7 10.4h-123.4c-5.7 0-8.2-6.8-3.7-10.4l58-46c2.1-1.7 4.7-2.6 7.4-2.6z" fill="#EE7B5C"/>
      ${win(1072, 278, 26, 22, true)}
      <rect x="1116" y="290" width="26" height="56" rx="4" fill="#4C9BE0"/>
      <rect x="1174" y="206" width="60" height="140" rx="5" fill="#7DB6B1"/>
      ${grid(1186, 222, 1, 3, 0, 36, 22, 20, [1], [])}
      <!-- cây, bụi, đường -->
      ${tree(612, 330, .95)}${tree(924, 334, .8)}${tree(1046, 336, .7)}
      <g fill="#58B97E"><ellipse cx="760" cy="344" rx="26" ry="10"/><ellipse cx="1180" cy="346" rx="30" ry="11"/><ellipse cx="560" cy="344" rx="22" ry="9"/></g>
      <rect y="342" width="1200" height="18" fill="#9ED3B2"/>
      <rect y="338" width="1200" height="6" fill="#86C79E"/>
    </svg>`;
    return { __raw: true, value: svg, toString() { return svg; } };
  }

  return { pic, scene, NAMES: Object.keys(P) };
})();
HH.pic = HH.art.pic;
HH.scene = HH.art.scene;
