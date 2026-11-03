// ==========================================================================
// ROUTES DATA: BANDARA & PELABUHAN KOMERSIL LENGKAP
// Khususnya yang ramai dipesan oleh warga Indonesia (Domestik & Internasional)
// ==========================================================================

const AIRPORTS_DATA = [
    {
        category: "✈️ Bandara Domestik - Jawa & Bali (Favorit)",
        airports: [
            { code: "CGK", name: "Jakarta - Soekarno Hatta", city: "Tangerang / Jakarta", label: "CGK - Jakarta (Soekarno-Hatta)" },
            { code: "HLP", name: "Jakarta - Halim Perdanakusuma", city: "Jakarta Timur", label: "HLP - Jakarta (Halim Perdanakusuma)" },
            { code: "SUB", name: "Surabaya - Juanda", city: "Sidoarjo / Surabaya", label: "SUB - Surabaya (Juanda)" },
            { code: "DPS", name: "Denpasar - I Gusti Ngurah Rai", city: "Denpasar, Bali", label: "DPS - Denpasar Bali (Ngurah Rai)" },
            { code: "YIA", name: "Yogyakarta - YIA Kulon Progo", city: "Kulon Progo, DIY", label: "YIA - Yogyakarta (Kulon Progo)" },
            { code: "JOG", name: "Yogyakarta - Adisutjipto", city: "Sleman, DIY", label: "JOG - Yogyakarta (Adisutjipto)" },
            { code: "SRG", name: "Semarang - Jenderal Ahmad Yani", city: "Semarang, Jawa Tengah", label: "SRG - Semarang (Ahmad Yani)" },
            { code: "SOC", name: "Solo - Adi Soemarmo", city: "Solo / Surakarta", label: "SOC - Solo / Surakarta (Adi Soemarmo)" },
            { code: "BDO", name: "Bandung - Husein Sastranegara", city: "Bandung, Jawa Barat", label: "BDO - Bandung (Husein Sastranegara)" },
            { code: "KJT", name: "Majalengka / Bandung - Kertajati", city: "Majalengka, Jawa Barat", label: "KJT - Majalengka / Kertajati" },
            { code: "MLG", name: "Malang - Abdul Rachman Saleh", city: "Malang, Jawa Timur", label: "MLG - Malang (Abdul Rachman Saleh)" },
            { code: "BWX", name: "Banyuwangi - Blimbingsari", city: "Banyuwangi, Jawa Timur", label: "BWX - Banyuwangi (Blimbingsari)" },
            { code: "CXP", name: "Cilacap - Tunggul Wulung", city: "Cilacap, Jawa Tengah", label: "CXP - Cilacap (Tunggul Wulung)" },
            { code: "PWL", name: "Purbalingga - Jenderal Besar Soedirman", city: "Purbalingga, Jawa Tengah", label: "PWL - Purbalingga (JB Soedirman)" }
        ]
    },
    {
        category: "✈️ Bandara Domestik - Sumatera",
        airports: [
            { code: "KNO", name: "Medan - Kualanamu", city: "Deli Serdang / Medan", label: "KNO - Medan (Kualanamu)" },
            { code: "BTH", name: "Batam - Hang Nadim", city: "Batam, Kepulauan Riau", label: "BTH - Batam (Hang Nadim)" },
            { code: "PKU", name: "Pekanbaru - Sultan Syarif Kasim II", city: "Pekanbaru, Riau", label: "PKU - Pekanbaru (Sultan Syarif Kasim II)" },
            { code: "PLM", name: "Palembang - Sultan Mahmud Badaruddin II", city: "Palembang, Sumatera Selatan", label: "PLM - Palembang (SMB II)" },
            { code: "PDG", name: "Padang - Minangkabau", city: "Padang Pariaman / Padang", label: "PDG - Padang (Minangkabau)" },
            { code: "TKG", name: "Bandar Lampung - Radin Inten II", city: "Lampung Selatan / Bandar Lampung", label: "TKG - Bandar Lampung (Radin Inten II)" },
            { code: "BTJ", name: "Banda Aceh - Sultan Iskandar Muda", city: "Banda Aceh, Aceh", label: "BTJ - Banda Aceh (Sultan Iskandar Muda)" },
            { code: "DJB", name: "Jambi - Sultan Thaha", city: "Jambi", label: "DJB - Jambi (Sultan Thaha)" },
            { code: "PGK", name: "Pangkal Pinang - Depati Amir", city: "Pangkal Pinang, Bangka", label: "PGK - Bangka / Pangkal Pinang (Depati Amir)" },
            { code: "TJQ", name: "Belitung - H.A.S. Hanandjoeddin", city: "Tanjung Pandan, Belitung", label: "TJQ - Belitung (Hanandjoeddin)" },
            { code: "TNJ", name: "Tanjung Pinang - Raja Haji Fisabilillah", city: "Tanjung Pinang, Bintan", label: "TNJ - Tanjung Pinang (RHF)" },
            { code: "BKS", name: "Bengkulu - Fatmawati Soekarno", city: "Bengkulu", label: "BKS - Bengkulu (Fatmawati Soekarno)" },
            { code: "DTB", name: "Danau Toba / Siborong-borong - Silangit", city: "Tapanuli Utara, Sumut", label: "DTB - Danau Toba (Silangit)" },
            { code: "FLZ", name: "Sibolga - Ferdinand Lumban Tobing", city: "Tapanuli Tengah, Sumut", label: "FLZ - Sibolga (FL Tobing)" },
            { code: "GNS", name: "Nias - Binaka", city: "Gunungsitoli, Nias", label: "GNS - Nias (Binaka)" }
        ]
    },
    {
        category: "✈️ Bandara Domestik - Kalimantan",
        airports: [
            { code: "BPN", name: "Balikpapan - SAMS Sepinggan", city: "Balikpapan, Kalimantan Timur", label: "BPN - Balikpapan (Sepinggan)" },
            { code: "BDJ", name: "Banjarmasin - Syamsudin Noor", city: "Banjarbaru / Banjarmasin, Kalsel", label: "BDJ - Banjarmasin (Syamsudin Noor)" },
            { code: "PNK", name: "Pontianak - Supadio", city: "Kubu Raya / Pontianak, Kalbar", label: "PNK - Pontianak (Supadio)" },
            { code: "AAP", name: "Samarinda - Aji Pangeran Tumenggung Pranoto", city: "Samarinda, Kalimantan Timur", label: "AAP - Samarinda (APT Pranoto)" },
            { code: "TRK", name: "Tarakan - Juwata", city: "Tarakan, Kalimantan Utara", label: "TRK - Tarakan (Juwata)" },
            { code: "PKY", name: "Palangkaraya - Tjilik Riwut", city: "Palangkaraya, Kalimantan Tengah", label: "PKY - Palangkaraya (Tjilik Riwut)" },
            { code: "BEJ", name: "Berau / Derawan - Kalimarau", city: "Berau, Kalimantan Timur", label: "BEJ - Berau / Derawan (Kalimarau)" },
            { code: "SMQ", name: "Sampit - H. Asan", city: "Kotawaringin Timur, Kalteng", label: "SMQ - Sampit (H. Asan)" },
            { code: "PKN", name: "Pangkalan Bun - Iskandar", city: "Kotawaringin Barat, Kalteng", label: "PKN - Pangkalan Bun (Iskandar)" }
        ]
    },
    {
        category: "✈️ Bandara Domestik - Sulawesi",
        airports: [
            { code: "UPG", name: "Makassar - Sultan Hasanuddin", city: "Maros / Makassar, Sulsel", label: "UPG - Makassar (Sultan Hasanuddin)" },
            { code: "MDC", name: "Manado - Sam Ratulangi", city: "Manado, Sulawesi Utara", label: "MDC - Manado (Sam Ratulangi)" },
            { code: "PLW", name: "Palu - Mutiara SIS Al-Jufrie", city: "Palu, Sulawesi Tengah", label: "PLW - Palu (Mutiara SIS Al-Jufrie)" },
            { code: "KDI", name: "Kendari - Haluoleo", city: "Konawe Selatan / Kendari, Sultra", label: "KDI - Kendari (Haluoleo)" },
            { code: "GTO", name: "Gorontalo - Djalaluddin", city: "Gorontalo", label: "GTO - Gorontalo (Djalaluddin)" },
            { code: "MJU", name: "Mamuju - Tampa Padang", city: "Mamuju, Sulawesi Barat", label: "MJU - Mamuju (Tampa Padang)" },
            { code: "LUW", name: "Luwuk - Syukuran Aminuddin Amir", city: "Banggai, Sulawesi Tengah", label: "LUW - Luwuk (SA Amir)" },
            { code: "BUW", name: "Baubau - Betoambari", city: "Baubau, Buton, Sultra", label: "BUW - Baubau (Betoambari)" }
        ]
    },
    {
        category: "✈️ Bandara Domestik - Nusa Tenggara",
        airports: [
            { code: "LOP", name: "Lombok - Zainuddin Abdul Madjid", city: "Praya, Lombok, NTB", label: "LOP - Lombok / Praya (ZAM)" },
            { code: "LBJ", name: "Labuan Bajo - Komodo", city: "Labuan Bajo, Flores, NTT", label: "LBJ - Labuan Bajo (Komodo)" },
            { code: "KOE", name: "Kupang - El Tari", city: "Kupang, NTT", label: "KOE - Kupang (El Tari)" },
            { code: "BMU", name: "Bima - Sultan Muhammad Salahudin", city: "Bima, Sumbawa, NTB", label: "BMU - Bima (SMS)" },
            { code: "SWQ", name: "Sumbawa Besar - Sultan Muhammad Kaharuddin III", city: "Sumbawa Besar, NTB", label: "SWQ - Sumbawa (S. Kaharuddin)" },
            { code: "MOF", name: "Maumere - Frans Seda", city: "Maumere, Flores, NTT", label: "MOF - Maumere (Frans Seda)" },
            { code: "ENE", name: "Ende - H. Hasan Aroeboesman", city: "Ende, Flores, NTT", label: "ENE - Ende (Hasan Aroeboesman)" },
            { code: "TMC", name: "Tambolaka - Lede Kalumbang", city: "Sumba Barat Daya, NTT", label: "TMC - Sumba / Tambolaka" },
            { code: "WGP", name: "Waingapu - Umbu Mehang Kunda", city: "Sumba Timur, NTT", label: "WGP - Waingapu (UMK)" }
        ]
    },
    {
        category: "✈️ Bandara Domestik - Maluku & Papua",
        airports: [
            { code: "AMQ", name: "Ambon - Pattimura", city: "Ambon, Maluku", label: "AMQ - Ambon (Pattimura)" },
            { code: "TTE", name: "Ternate - Sultan Babullah", city: "Ternate, Maluku Utara", label: "TTE - Ternate (Sultan Babullah)" },
            { code: "SOQ", name: "Sorong - Domine Eduard Osok (Raja Ampat)", city: "Sorong, Papua Barat Daya", label: "SOQ - Sorong / Raja Ampat (DE Osok)" },
            { code: "DJJ", name: "Jayapura - Sentani", city: "Jayapura, Papua", label: "DJJ - Jayapura (Sentani)" },
            { code: "TIM", name: "Timika - Mozes Kilangin", city: "Timika, Papua Tengah", label: "TIM - Timika (Mozes Kilangin)" },
            { code: "MKW", name: "Manokwari - Rendani", city: "Manokwari, Papua Barat", label: "MKW - Manokwari (Rendani)" },
            { code: "MKQ", name: "Merauke - Mopah", city: "Merauke, Papua Selatan", label: "MKQ - Merauke (Mopah)" },
            { code: "BIK", name: "Biak - Frans Kaisiepo", city: "Biak Numfor, Papua", label: "BIK - Biak (Frans Kaisiepo)" },
            { code: "NBX", name: "Nabire - Douw Aturure", city: "Nabire, Papua Tengah", label: "NBX - Nabire (Douw Aturure)" }
        ]
    },
    {
        category: "🕋 Bandara Umrah & Haji (Arab Saudi)",
        airports: [
            { code: "JED", name: "Jeddah - King Abdulaziz International", city: "Jeddah, Arab Saudi", label: "JED - Jeddah (King Abdulaziz - Umrah/Haji)" },
            { code: "MED", name: "Madinah - Prince Mohammad bin Abdulaziz", city: "Madinah, Arab Saudi", label: "MED - Madinah (Prince Mohammad - Umrah/Haji)" },
            { code: "RUH", name: "Riyadh - King Khalid International", city: "Riyadh, Arab Saudi", label: "RUH - Riyadh (King Khalid)" },
            { code: "DMM", name: "Dammam - King Fahd International", city: "Dammam, Arab Saudi", label: "DMM - Dammam (King Fahd)" },
            { code: "TIF", name: "Taif - Ta'if Regional", city: "Taif, Arab Saudi", label: "TIF - Taif Regional Airport" }
        ]
    },
    {
        category: "🌏 Internasional Populer - Asia Tenggara",
        airports: [
            { code: "SIN", name: "Singapura - Changi International", city: "Singapura", label: "SIN - Singapura (Singapore Changi)" },
            { code: "KUL", name: "Kuala Lumpur - KLIA / KLIA2", city: "Sepang, Selangor, Malaysia", label: "KUL - Kuala Lumpur (KLIA / KLIA2)" },
            { code: "PEN", name: "Penang - Penang International", city: "Bayan Lepas, Penang, Malaysia", label: "PEN - Penang (Penang Intl - Medis)" },
            { code: "JHB", name: "Johor Bahru - Senai International", city: "Johor Bahru, Malaysia", label: "JHB - Johor Bahru (Senai Intl)" },
            { code: "BKI", name: "Kota Kinabalu International", city: "Sabah, Malaysia", label: "BKI - Kota Kinabalu (Sabah)" },
            { code: "KCH", name: "Kuching International", city: "Sarawak, Malaysia", label: "KCH - Kuching (Sarawak)" },
            { code: "BKK", name: "Bangkok - Suvarnabhumi", city: "Bangkok, Thailand", label: "BKK - Bangkok (Suvarnabhumi)" },
            { code: "DMK", name: "Bangkok - Don Mueang", city: "Bangkok, Thailand", label: "DMK - Bangkok (Don Mueang - LCC)" },
            { code: "HKT", name: "Phuket International", city: "Phuket, Thailand", label: "HKT - Phuket (Phuket Intl)" },
            { code: "SGN", name: "Ho Chi Minh City - Tan Son Nhat", city: "Ho Chi Minh, Vietnam", label: "SGN - Ho Chi Minh City (Tan Son Nhat)" },
            { code: "HAN", name: "Hanoi - Noi Bai International", city: "Hanoi, Vietnam", label: "HAN - Hanoi (Noi Bai Intl)" },
            { code: "MNL", name: "Manila - Ninoy Aquino", city: "Manila, Filipina", label: "MNL - Manila (Ninoy Aquino)" },
            { code: "BWN", name: "Bandar Seri Begawan - Brunei International", city: "Bandar Seri Begawan, Brunei", label: "BWN - Brunei (Brunei Intl)" },
            { code: "PNH", name: "Phnom Penh International", city: "Phnom Penh, Kamboja", label: "PNH - Phnom Penh, Kamboja" }
        ]
    },
    {
        category: "⛩️ Internasional Populer - Asia Timur (Jepang, Korea, Tiongkok)",
        airports: [
            { code: "HND", name: "Tokyo - Haneda Airport", city: "Tokyo, Jepang", label: "HND - Tokyo Haneda, Jepang" },
            { code: "NRT", name: "Tokyo - Narita International", city: "Chiba / Tokyo, Jepang", label: "NRT - Tokyo Narita, Jepang" },
            { code: "KIX", name: "Osaka - Kansai International", city: "Osaka, Jepang", label: "KIX - Osaka Kansai, Jepang" },
            { code: "NGO", name: "Nagoya - Chubu Centrair", city: "Nagoya, Jepang", label: "NGO - Nagoya (Chubu Centrair)" },
            { code: "FUK", name: "Fukuoka Airport", city: "Fukuoka, Jepang", label: "FUK - Fukuoka, Jepang" },
            { code: "ICN", name: "Seoul - Incheon International", city: "Incheon / Seoul, Korea Selatan", label: "ICN - Seoul (Incheon Intl), Korea" },
            { code: "GMP", name: "Seoul - Gimpo International", city: "Seoul, Korea Selatan", label: "GMP - Seoul (Gimpo Intl), Korea" },
            { code: "PUS", name: "Busan - Gimhae International", city: "Busan, Korea Selatan", label: "PUS - Busan (Gimhae Intl), Korea" },
            { code: "HKG", name: "Hong Kong International", city: "Chek Lap Kok, Hong Kong", label: "HKG - Hong Kong International" },
            { code: "MFM", name: "Macau International", city: "Taipa, Macau", label: "MFM - Macau International" },
            { code: "TPE", name: "Taipei - Taoyuan International", city: "Taoyuan / Taipei, Taiwan", label: "TPE - Taipei (Taoyuan Intl), Taiwan" },
            { code: "KHH", name: "Kaohsiung International", city: "Kaohsiung, Taiwan", label: "KHH - Kaohsiung, Taiwan" },
            { code: "CAN", name: "Guangzhou - Baiyun International", city: "Guangzhou, China", label: "CAN - Guangzhou (Baiyun), China" },
            { code: "PVG", name: "Shanghai - Pudong International", city: "Shanghai, China", label: "PVG - Shanghai (Pudong Intl), China" },
            { code: "PEK", name: "Beijing - Capital International", city: "Beijing, China", label: "PEK - Beijing Capital, China" },
            { code: "PKX", name: "Beijing - Daxing International", city: "Beijing, China", label: "PKX - Beijing Daxing, China" }
        ]
    },
    {
        category: "🦘 Internasional Populer - Australia & Selandia Baru",
        airports: [
            { code: "SYD", name: "Sydney - Kingsford Smith", city: "Sydney, NSW, Australia", label: "SYD - Sydney (Kingsford Smith), Australia" },
            { code: "MEL", name: "Melbourne - Tullamarine", city: "Melbourne, VIC, Australia", label: "MEL - Melbourne (Tullamarine), Australia" },
            { code: "PER", name: "Perth Airport", city: "Perth, WA, Australia", label: "PER - Perth, Australia" },
            { code: "BNE", name: "Brisbane Airport", city: "Brisbane, QLD, Australia", label: "BNE - Brisbane, Australia" },
            { code: "ADL", name: "Adelaide Airport", city: "Adelaide, SA, Australia", label: "ADL - Adelaide, Australia" },
            { code: "AKL", name: "Auckland Airport", city: "Auckland, Selandia Baru", label: "AKL - Auckland, Selandia Baru" }
        ]
    },
    {
        category: "🌍 Internasional - Timur Tengah, Eropa & Amerika Serikat",
        airports: [
            { code: "DXB", name: "Dubai International", city: "Dubai, UEA", label: "DXB - Dubai International, UEA" },
            { code: "AUH", name: "Abu Dhabi - Zayed International", city: "Abu Dhabi, UEA", label: "AUH - Abu Dhabi (Zayed Intl), UEA" },
            { code: "DOH", name: "Doha - Hamad International", city: "Doha, Qatar", label: "DOH - Doha (Hamad Intl), Qatar" },
            { code: "IST", name: "Istanbul Airport", city: "Istanbul, Turki", label: "IST - Istanbul Airport, Turki" },
            { code: "LHR", name: "London - Heathrow", city: "London, Inggris / UK", label: "LHR - London Heathrow, Inggris" },
            { code: "AMS", name: "Amsterdam - Schiphol", city: "Amsterdam, Belanda", label: "AMS - Amsterdam Schiphol, Belanda" },
            { code: "CDG", name: "Paris - Charles de Gaulle", city: "Paris, Prancis", label: "CDG - Paris (Charles de Gaulle), Prancis" },
            { code: "FRA", name: "Frankfurt Airport", city: "Frankfurt, Jerman", label: "FRA - Frankfurt, Jerman" },
            { code: "JFK", name: "New York - John F. Kennedy", city: "New York, AS", label: "JFK - New York (JFK), AS" },
            { code: "LAX", name: "Los Angeles International", city: "Los Angeles, CA, AS", label: "LAX - Los Angeles (LAX), AS" },
            { code: "SFO", name: "San Francisco International", city: "San Francisco, CA, AS", label: "SFO - San Francisco (SFO), AS" }
        ]
    }
];

const SEAPORTS_DATA = [
    {
        category: "🚢 Pelabuhan Penyeberangan Ferry & Roro Utama",
        ports: [
            { name: "Pelabuhan Merak", location: "Cilegon, Banten", label: "Merak - Cilegon, Banten (Lintas Merak-Bakauheni)" },
            { name: "Pelabuhan Bakauheni", location: "Lampung Selatan", label: "Bakauheni - Lampung Selatan (Lintas Merak-Bakauheni)" },
            { name: "Pelabuhan Ketapang", location: "Banyuwangi, Jawa Timur", label: "Ketapang - Banyuwangi, Jatim (Lintas Ketapang-Gilimanuk)" },
            { name: "Pelabuhan Gilimanuk", location: "Jembrana, Bali", label: "Gilimanuk - Jembrana, Bali (Lintas Ketapang-Gilimanuk)" },
            { name: "Pelabuhan Padangbai", location: "Karangasem, Bali", label: "Padangbai - Karangasem, Bali (Lintas Bali-Lombok)" },
            { name: "Pelabuhan Lembar", location: "Lombok Barat, NTB", label: "Lembar - Lombok Barat, NTB (Lintas Bali-Lombok / Surabaya)" },
            { name: "Pelabuhan Kayangan", location: "Lombok Timur, NTB", label: "Kayangan - Lombok Timur, NTB" },
            { name: "Pelabuhan Poto Tano", location: "Sumbawa Barat, NTB", label: "Poto Tano - Sumbawa Barat, NTB" },
            { name: "Pelabuhan Sape", location: "Bima, Sumbawa, NTB", label: "Sape - Bima, NTB (Lintas Bima-Labuan Bajo)" },
            { name: "Pelabuhan Labuan Bajo", location: "Manggarai Barat, Flores, NTT", label: "Labuan Bajo - Flores, NTT" },
            { name: "Pelabuhan Jepara (Kartini)", location: "Jepara, Jawa Tengah", label: "Jepara (Kartini) - Jawa Tengah (Ferry Karimunjawa)" },
            { name: "Pelabuhan Karimunjawa", location: "Karimunjawa, Jawa Tengah", label: "Karimunjawa - Jawa Tengah" },
            { name: "Pelabuhan Tanjung Kalian (Muntok)", location: "Bangka Barat", label: "Tanjung Kalian (Muntok) - Bangka Barat" },
            { name: "Pelabuhan Tanjung Api-Api", location: "Banyuasin, Sumsel", label: "Tanjung Api-Api - Banyuasin, Sumsel" }
        ]
    },
    {
        category: "🚢 Pelabuhan Komersil & Pelni - Jawa & Madura",
        ports: [
            { name: "Pelabuhan Tanjung Priok", location: "Jakarta Utara", label: "Tanjung Priok - Jakarta Utara (Pelni & Penumpang)" },
            { name: "Pelabuhan Sunda Kelapa", location: "Jakarta Utara", label: "Sunda Kelapa - Jakarta Utara" },
            { name: "Pelabuhan Muara Angke / Kaliadem", location: "Jakarta Utara", label: "Muara Angke / Kaliadem - Jakarta (Kapal Kepulauan Seribu)" },
            { name: "Pelabuhan Tanjung Perak", location: "Surabaya, Jawa Timur", label: "Tanjung Perak - Surabaya, Jatim (Hub Pelni Timur)" },
            { name: "Pelabuhan Tanjung Emas", location: "Semarang, Jawa Tengah", label: "Tanjung Emas - Semarang, Jateng" },
            { name: "Pelabuhan Tanjung Wangi", location: "Banyuwangi, Jawa Timur", label: "Tanjung Wangi - Banyuwangi, Jatim" },
            { name: "Pelabuhan Kalianget", location: "Sumenep, Madura, Jatim", label: "Kalianget - Sumenep, Madura" },
            { name: "Pelabuhan Jangkar", location: "Situbondo, Jawa Timur", label: "Jangkar - Situbondo, Jatim" },
            { name: "Pelabuhan Paciran", location: "Lamongan, Jawa Timur", label: "Paciran - Lamongan, Jatim" }
        ]
    },
    {
        category: "🚢 Pelabuhan Komersil - Sumatera & Kepulauan Riau",
        ports: [
            { name: "Pelabuhan Belawan", location: "Medan, Sumatera Utara", label: "Belawan - Medan, Sumatera Utara" },
            { name: "Pelabuhan Batam Centre", location: "Batam, Kepulauan Riau", label: "Batam Centre - Batam, Kepri (Feri Domestik/Singapura)" },
            { name: "Pelabuhan Harbour Bay", location: "Batam, Kepulauan Riau", label: "Harbour Bay - Batam, Kepri" },
            { name: "Pelabuhan Sekupang", location: "Batam, Kepulauan Riau", label: "Sekupang - Batam, Kepri (Domestik Riau/Sumatera)" },
            { name: "Pelabuhan Telaga Punggur", location: "Batam, Kepulauan Riau", label: "Telaga Punggur - Batam, Kepri (Roro ke Bintan)" },
            { name: "Pelabuhan Sri Bintan Pura", location: "Tanjung Pinang, Bintan", label: "Sri Bintan Pura - Tanjung Pinang, Kepri" },
            { name: "Pelabuhan Bandar Bentan Telani (BBT)", location: "Lagoi, Bintan, Kepri", label: "Bandar Bentan Telani (Lagoi) - Bintan" },
            { name: "Pelabuhan Tanjung Balai Karimun", location: "Karimun, Kepri", label: "Tanjung Balai Karimun - Kepri" },
            { name: "Pelabuhan Dumai", location: "Dumai, Riau", label: "Dumai - Riau (Lintas Dumai-Malaka/Malaysia)" },
            { name: "Pelabuhan Boom Baru", location: "Palembang, Sumatera Selatan", label: "Boom Baru - Palembang, Sumsel" },
            { name: "Pelabuhan Pangkal Balam", location: "Pangkal Pinang, Bangka", label: "Pangkal Balam - Pangkal Pinang, Bangka" },
            { name: "Pelabuhan Tanjung Pandan", location: "Belitung", label: "Tanjung Pandan - Belitung" },
            { name: "Pelabuhan Teluk Bayur", location: "Padang, Sumatera Barat", label: "Teluk Bayur - Padang, Sumbar" },
            { name: "Pelabuhan Sibolga", location: "Sibolga, Sumatera Utara", label: "Sibolga - Sumut (Ferry ke Nias)" },
            { name: "Pelabuhan Gunung Sitoli", location: "Nias, Sumatera Utara", label: "Gunung Sitoli - Nias, Sumut" },
            { name: "Pelabuhan Ulee Lheue", location: "Banda Aceh", label: "Ulee Lheue - Banda Aceh (Feri ke Sabang)" },
            { name: "Pelabuhan Balohan", location: "Sabang, Pulau Weh, Aceh", label: "Balohan - Sabang, Pulau Weh, Aceh" }
        ]
    },
    {
        category: "🚢 Pelabuhan Komersil - Kalimantan",
        ports: [
            { name: "Pelabuhan Semayang", location: "Balikpapan, Kalimantan Timur", label: "Semayang - Balikpapan, Kaltim (Pelni & Penumpang)" },
            { name: "Pelabuhan Kariangau", location: "Balikpapan, Kalimantan Timur", label: "Kariangau - Balikpapan (Ferry Roro)" },
            { name: "Pelabuhan Trisakti", location: "Banjarmasin, Kalimantan Selatan", label: "Trisakti - Banjarmasin, Kalsel" },
            { name: "Pelabuhan Dwikora", location: "Pontianak, Kalimantan Barat", label: "Dwikora - Pontianak, Kalbar" },
            { name: "Pelabuhan Sampit", location: "Kotawaringin Timur, Kalteng", label: "Sampit - Kotawaringin Timur, Kalteng" },
            { name: "Pelabuhan Panglima Utar (Kumai)", location: "Pangkalan Bun, Kalteng", label: "Kumai / Panglima Utar - Pangkalan Bun, Kalteng" },
            { name: "Pelabuhan Samarinda", location: "Samarinda, Kalimantan Timur", label: "Samarinda - Kalimantan Timur" },
            { name: "Pelabuhan Malundung", location: "Tarakan, Kalimantan Utara", label: "Malundung - Tarakan, Kaltara" },
            { name: "Pelabuhan Tunon Taka (Nunukan)", location: "Nunukan, Kalimantan Utara", label: "Tunon Taka - Nunukan, Kaltara (Perbatasan Tawau)" }
        ]
    },
    {
        category: "🚢 Pelabuhan Komersil - Sulawesi",
        ports: [
            { name: "Pelabuhan Soekarno-Hatta Makassar", location: "Makassar, Sulawesi Selatan", label: "Soekarno-Hatta - Makassar, Sulsel (Hub Pelni Timur)" },
            { name: "Pelabuhan Bitung", location: "Bitung, Sulawesi Utara", label: "Bitung - Sulawesi Utara" },
            { name: "Pelabuhan Pantoloan", location: "Palu / Donggala, Sulteng", label: "Pantoloan - Palu / Donggala, Sulteng" },
            { name: "Pelabuhan Nusantara Parepare", location: "Parepare, Sulawesi Selatan", label: "Nusantara - Parepare, Sulsel" },
            { name: "Pelabuhan Murhum", location: "Baubau, Buton, Sultra", label: "Murhum - Baubau, Buton, Sultra" },
            { name: "Pelabuhan Bungkutoko / Nusantara Kendari", location: "Kendari, Sulawesi Tenggara", label: "Bungkutoko / Nusantara - Kendari, Sultra" },
            { name: "Pelabuhan Gorontalo", location: "Kota Gorontalo", label: "Pelabuhan Gorontalo" },
            { name: "Pelabuhan Kolaka", location: "Kolaka, Sulawesi Tenggara", label: "Kolaka - Sultra (Lintas Bajoe-Kolaka)" },
            { name: "Pelabuhan Bajoe", location: "Bone, Sulawesi Selatan", label: "Bajoe - Bone, Sulsel (Lintas Bajoe-Kolaka)" },
            { name: "Pelabuhan Siwa", location: "Wajo, Sulawesi Selatan", label: "Siwa - Wajo, Sulsel (Feri ke Tobaku)" }
        ]
    },
    {
        category: "🚢 Pelabuhan Komersil - Bali & Nusa Tenggara",
        ports: [
            { name: "Pelabuhan Benoa", location: "Denpasar, Bali", label: "Benoa - Denpasar, Bali (Pelni & Cruise)" },
            { name: "Pelabuhan Sanur", location: "Denpasar, Bali", label: "Sanur - Denpasar, Bali (Fastboat Nusa Penida)" },
            { name: "Pelabuhan Nusa Penida", location: "Klungkung, Bali", label: "Nusa Penida - Klungkung, Bali" },
            { name: "Pelabuhan Tenau", location: "Kupang, NTT", label: "Tenau - Kupang, NTT" },
            { name: "Pelabuhan Waingapu", location: "Sumba Timur, NTT", label: "Waingapu - Sumba Timur, NTT" },
            { name: "Pelabuhan Lorens Say (Maumere)", location: "Sikka, Flores, NTT", label: "Lorens Say - Maumere, Flores, NTT" },
            { name: "Pelabuhan Larantuka", location: "Flores Timur, NTT", label: "Larantuka - Flores Timur, NTT" },
            { name: "Pelabuhan Kalabahi", location: "Alor, NTT", label: "Kalabahi - Alor, NTT" }
        ]
    },
    {
        category: "🚢 Pelabuhan Komersil - Maluku & Papua",
        ports: [
            { name: "Pelabuhan Yos Sudarso (Ambon)", location: "Ambon, Maluku", label: "Yos Sudarso - Ambon, Maluku" },
            { name: "Pelabuhan Ahmad Yani (Ternate)", location: "Ternate, Maluku Utara", label: "Ahmad Yani - Ternate, Maluku Utara" },
            { name: "Pelabuhan Namlea", location: "Pulau Buru, Maluku", label: "Namlea - Pulau Buru, Maluku" },
            { name: "Pelabuhan Tual", location: "Maluku Tenggara", label: "Tual - Maluku Tenggara" },
            { name: "Pelabuhan Sorong", location: "Sorong, Papua Barat Daya", label: "Pelabuhan Sorong - Papua Barat Daya" },
            { name: "Pelabuhan Jayapura", location: "Jayapura, Papua", label: "Pelabuhan Jayapura - Papua" },
            { name: "Pelabuhan Manokwari", location: "Manokwari, Papua Barat", label: "Pelabuhan Manokwari - Papua Barat" },
            { name: "Pelabuhan Biak", location: "Biak Numfor, Papua", label: "Pelabuhan Biak - Papua" },
            { name: "Pelabuhan Merauke", location: "Merauke, Papua Selatan", label: "Pelabuhan Merauke - Papua Selatan" },
            { name: "Pelabuhan Fakfak", location: "Fakfak, Papua Barat", label: "Pelabuhan Fakfak - Papua Barat" },
            { name: "Pelabuhan Pomako (Timika)", location: "Mimika, Papua Tengah", label: "Pomako - Timika, Papua Tengah" },
            { name: "Pelabuhan Nabire", location: "Nabire, Papua Tengah", label: "Pelabuhan Nabire - Papua Tengah" }
        ]
    },
    {
        category: "🚢 Pelabuhan Internasional Feri (Dekat Indonesia)",
        ports: [
            { name: "HarbourFront Centre", location: "Singapura", label: "HarbourFront - Singapura (Feri Batam/Bintan)" },
            { name: "Tanah Merah Ferry Terminal", location: "Singapura", label: "Tanah Merah - Singapura (Feri Batam/Bintan)" },
            { name: "Stulang Laut Ferry Terminal", location: "Johor Bahru, Malaysia", label: "Stulang Laut - Johor Bahru, Malaysia (Feri Batam)" },
            { name: "Pasir Gudang Ferry Terminal", location: "Johor, Malaysia", label: "Pasir Gudang - Johor, Malaysia" },
            { name: "Melaka Ferry Terminal", location: "Melaka, Malaysia", label: "Melaka Ferry Terminal - Malaysia (Feri Dumai)" },
            { name: "Port Klang", location: "Selangor, Malaysia", label: "Port Klang - Kuala Lumpur, Malaysia" },
            { name: "Penang Port (Swettenham Pier)", location: "George Town, Penang, Malaysia", label: "Penang Port (Swettenham Pier) - Malaysia" }
        ]
    }
];

const POPULAR_AIRLINES = [
    "Garuda Indonesia",
    "Citilink",
    "Lion Air",
    "Batik Air",
    "Super Air Jet",
    "Wings Air",
    "Pelita Air",
    "Sriwijaya Air",
    "NAM Air",
    "AirAsia Indonesia",
    "AirAsia Malaysia",
    "Scoot",
    "Singapore Airlines",
    "Malaysia Airlines",
    "Saudia Airlines",
    "flynas",
    "Qatar Airways",
    "Emirates",
    "Etihad Airways",
    "Turkish Airlines",
    "All Nippon Airways (ANA)",
    "Japan Airlines (JAL)",
    "Korean Air",
    "Cathay Pacific",
    "Qantas Airways"
];

const POPULAR_SHIPS = [
    "PELNI",
    "PELNI - KM Kelimutu",
    "PELNI - KM Awu",
    "PELNI - KM Bukit Raya",
    "PELNI - KM Ciremai",
    "PELNI - KM Dobonsolo",
    "PELNI - KM Dorolonda",
    "PELNI - KM Gunung Dempo",
    "PELNI - KM Labobar",
    "PELNI - KM Lambelu",
    "PELNI - KM Leuser",
    "PELNI - KM Nggapulu",
    "PELNI - KM Pangrango",
    "PELNI - KM Sangiang",
    "PELNI - KM Sinabung",
    "PELNI - KM Sirimau",
    "PELNI - KM Tatamailau",
    "PELNI - KM Tidar",
    "PELNI - KM Tilongkabila",
    "PELNI - KM Umsini",
    "ASDP Indonesia Ferry (Roro)",
    "Dharma Lautan Utama (DLU)",
    "DLU - KM Dharma Rucita 9",
    "DLU - KM Dharma Kartika",
    "DLU - KM Dharma Ferry",
    "Atosim Lampung Pelayaran (ALP)",
    "BatamFast Ferry",
    "Majestic Fast Ferry",
    "Sindo Ferry",
    "Express Bahari",
    "Jembatan Nusantara",
    "Berlian Lautan Sejahtera"
];

// Helper to populate Asal & Tujuan selects dynamically
function populateRouteDropdown(selectElementId, tipe, selectedValue = '') {
    const el = document.getElementById(selectElementId);
    if (!el) return;

    const isPlane = (tipe === 'PESAWAT');
    const data = isPlane ? AIRPORTS_DATA : SEAPORTS_DATA;
    const placeholderText = isPlane ? '-- Pilih Bandara --' : '-- Pilih Pelabuhan --';

    let html = `<option value="">${placeholderText}</option>`;

    let hasMatched = false;
    const normSelected = String(selectedValue || '').trim().toLowerCase();

    data.forEach(group => {
        html += `<optgroup label="${group.category}">`;
        const items = isPlane ? group.airports : group.ports;
        items.forEach(item => {
            const val = item.label;
            const isSelected = normSelected && (
                normSelected === val.toLowerCase() ||
                (isPlane && normSelected === item.code.toLowerCase()) ||
                normSelected === item.name.toLowerCase()
            );
            if (isSelected) hasMatched = true;
            html += `<option value="${val}" ${isSelected ? 'selected' : ''}>${val}</option>`;
        });
        html += `</optgroup>`;
    });

    // If selected value was custom and wasn't in list, inject it at top so it is not lost
    if (selectedValue && !hasMatched && selectedValue !== 'MANUAL') {
        html = `<option value="${selectedValue}" selected>${selectedValue} (Tersimpan)</option>` + html;
    }

    html += `<optgroup label="✏️ Lainnya / Kustom">`;
    html += `<option value="MANUAL" ${selectedValue === 'MANUAL' ? 'selected' : ''}>✏️ Ketik Manual Lainnya...</option>`;
    html += `</optgroup>`;

    el.innerHTML = html;
}

// Helper to populate vendor datalist
function populateVendorDatalist(datalistId, tipe) {
    const dl = document.getElementById(datalistId);
    if (!dl) return;
    const list = (tipe === 'PESAWAT') ? POPULAR_AIRLINES : POPULAR_SHIPS;
    dl.innerHTML = list.map(v => `<option value="${v}"></option>`).join('');
}

// Export to window
if (typeof window !== 'undefined') {
    window.AIRPORTS_DATA = AIRPORTS_DATA;
    window.SEAPORTS_DATA = SEAPORTS_DATA;
    window.POPULAR_AIRLINES = POPULAR_AIRLINES;
    window.POPULAR_SHIPS = POPULAR_SHIPS;
    window.populateRouteDropdown = populateRouteDropdown;
    window.populateVendorDatalist = populateVendorDatalist;
}

