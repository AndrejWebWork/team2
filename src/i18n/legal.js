// Правни текстови (шаблон) за EkoSkopje — Приватност, Услови и Атрибуција.
// Одвоено од translations.js за прегледност. Секој документ има наслов и
// низа секции { h, p: [...] }. Ова се стандардни шаблонски текстови усогласени
// со ЗЗЛП (RS Македонија) и начелата на GDPR — финалната верзија треба да ја
// потврди правно лице од Град Скопје.

export const LEGAL_UPDATED = '2026-07-13'
export const LEGAL_OPERATOR = 'Град Скопје'
export const LEGAL_CONTACT = 'kontakt@skopje.gov.mk'

export const legalContent = {
  mk: {
    updatedLabel: 'Последно ажурирање',
    operatorLabel: 'Оператор на податоците',
    privacy: {
      title: 'Политика за приватност',
      sections: [
        { h: 'Вовед', p: [
          'Оваа Политика за приватност објаснува како апликацијата „EkoSkopje“ ги собира, користи, чува и заштитува вашите лични податоци. Оператор на обработката е Град Скопје. Обработката се врши во согласност со Законот за заштита на личните податоци и начелата на Општата регулатива за заштита на податоци (GDPR).',
          'Со користење на апликацијата потврдувате дека сте ја прочитале оваа политика. Ако не се согласувате, може да ја користите апликацијата анонимно или да престанете со користење.',
        ] },
        { h: 'Кои податоци ги собираме', p: [
          'Податоци од регистрација (по избор): е-пошта, име и презиме и лозинка (која се чува исклучиво во криптиран/хеширан облик и никогаш во читлив текст).',
          'Податоци од пријави: локација (GPS координати), општина, опис, категорија и фотографии што доброволно ги прикачувате.',
          'Технички податоци: идентификатор на уред за анонимни корисници, избран јазик, статус на сесијата и основни поставки, зачувани локално на вашиот уред.',
          'Известувања: ако дозволите push известувања, се чува токен за испраќање пораки до вашиот уред (преку Google Firebase Cloud Messaging). Дозволата може да ја повлечете во секое време во поставките на уредот.',
          'Не собираме повеќе податоци отколку што е неопходно за функционирање на услугата (начело на минимизација).',
        ] },
        { h: 'Зошто ги обработуваме', p: [
          'За прием и обработка на пријави за диви депонии, контејнери и загадување, и нивно проследување до надлежните служби.',
          'За прикажување на квалитетот на воздухот и релевантни известувања.',
          'За доделување поени и водење на ранг-листа, како и за анонимна статистика заради подобрување на услугата.',
          'Правна основа: ваша согласност и извршување задача од јавен интерес од страна на Град Скопје.',
        ] },
        { h: 'Фотографии и локација', p: [
          'Пристапот до камера и локација се бара само кога вие иницирате пријава и служи исклучиво за таа намена.',
          'Ве молиме да не прикачувате фотографии на кои се јасно препознатливи лица, регистарски таблички или друга туѓа лична информација без основа.',
          'Локацијата на пријавата може да биде видлива за администраторите и, во агрегирана форма, за јавноста заради транспарентност.',
        ] },
        { h: 'Чување и рок', p: [
          'Податоците се чуваат само додека е потребно за целите наведени погоре или додека постои вашата сметка.',
          'Сметката може да ја избришете во секое време директно во апликацијата (Поставки → Сметка → Избриши сметка). Со тоа трајно се бришат вашите лични податоци, а поднесените пријави остануваат во анонимизирана форма (без поврзаност со вас).',
          'Податоците на анонимни корисници се чуваат локално на уредот (кеш) и може да ги избришете во секое време преку поставките на уредот или бришење на податоците на апликацијата.',
        ] },
        { h: 'Споделување со трети страни и обработувачи', p: [
          'Податоците од пријавите може да се проследат до надлежни комунални и инспекциски служби заради постапување.',
          'За техничко функционирање користиме обработувачи: Vercel Inc. (хостинг на апликацијата), Neon Inc. (база на податоци, сервери во ЕУ — Франкфурт) и Google LLC (Firebase Cloud Messaging, само за испорака на известувања). Овие даватели обработуваат податоци исклучиво по наши инструкции.',
          'Не продаваме и не изнајмуваме лични податоци за маркетинг цели на трети страни.',
        ] },
        { h: 'Деца', p: [
          'Апликацијата не е наменета за деца под 16 години и свесно не собираме нивни лични податоци. Ако сте родител/старател и сметате дека дете ни доставило лични податоци, контактирајте нè за да ги избришеме.',
        ] },
        { h: 'Вашите права', p: [
          'Имате право на пристап, исправка, бришење и ограничување на обработката, право на приговор и повлекување согласност во секое време.',
          'За остварување на овие права контактирајте нè на е-поштата наведена подолу. Имате право и на поплака до Агенцијата за заштита на личните податоци.',
        ] },
        { h: 'Безбедност', p: [
          'Применуваме соодветни технички и организациски мерки (криптирање на лозинки, безбедна комуникација, контрола на пристап) за заштита на податоците од неовластен пристап.',
        ] },
        { h: 'Контакт', p: [
          'За прашања поврзани со приватноста контактирајте го Град Скопје на: kontakt@skopje.gov.mk',
        ] },
      ],
    },
    terms: {
      title: 'Услови за користење',
      sections: [
        { h: 'Прифаќање на условите', p: [
          'Со користење на апликацијата „EkoSkopje“ се согласувате со овие Услови за користење. Ако не се согласувате, ве молиме не ја користете апликацијата.',
        ] },
        { h: 'Намена на услугата', p: [
          'EkoSkopje е граѓанска платформа за пријавување еколошки проблеми (диви депонии, контејнери, загадување) и следење на квалитетот на воздухот на подрачјето на Град Скопје.',
        ] },
        { h: 'Обврски на корисникот', p: [
          'Пријавите мора да бидат вистинити и добронамерни. Забрането е поднесување лажни, навредливи, заведувачки или злонамерни пријави.',
          'Забрането е прикачување содржина што е незаконска, навредлива, што ги повредува правата на трети лица или содржи лични податоци на други лица без основа.',
          'Корисникот е одговорен за точноста на податоците што ги внесува.',
        ] },
        { h: 'Содржина од корисници', p: [
          'Со прикачување содржина му давате на Град Скопје неисклучиво право таа содржина да ја користи за целите на услугата (обработка на пријави, статистика, известување на јавноста).',
          'Град Скопје го задржува правото да отстрани содржина или да ограничи сметка што ги крши овие услови.',
        ] },
        { h: 'Улога „заедница/организација“', p: [
          'Одредени верификувани корисници (организации, заедници) може да објавуваат акции и настани. Тие се одговорни за содржината што ја објавуваат и за нејзината точност.',
        ] },
        { h: 'Одрекување одговорност', p: [
          'Податоците за квалитет на воздухот доаѓаат од надворешни извори (WAQI, pulse.eco) и се прикажуваат информативно. Град Скопје не гарантира нивна апсолутна точност или достапност.',
          'Услугата се обезбедува „како што е“, без гаранции за непрекинатост или отсуство на грешки.',
        ] },
        { h: 'Измени на условите', p: [
          'Овие услови може повремено да се менуваат. Продолженото користење по измените значи прифаќање на новите услови.',
        ] },
      ],
    },
    attribution: {
      title: 'Извори на податоци и атрибуција',
      sections: [
        { h: 'Квалитет на воздух', p: [
          'Податоците за квалитетот на воздухот се обезбедени од World Air Quality Index (WAQI) — waqi.info и од pulse.eco мрежата на сензори.',
          'Референтните мерења потекнуваат од официјалните станици на надлежните институции, додека нереферентните се од граѓански/приватни сензори и служат само информативно.',
          'Сензорните уреди не извршуваат мерења по референтни методи и податоците произлезени од иститите се исклучиво за првична проценка на квалитетот на амбиентниот воздух.',
          'За секоја подетална анализа и толкување на состојбите со амбиентниот воздух се потребни дополнителни мерења согласно законската регулатива од областа на амбиентниот воздух.',
        ] },
        { h: 'Картографски податоци', p: [
          'Мапите и геолокациските податоци се базираат на OpenStreetMap (© OpenStreetMap contributors) и услуги за обратно геокодирање (Nominatim).',
          'Картографските плочки се обезбедени од CARTO (© CARTO) и Esri World Imagery (© Esri, Maxar, Earthstar Geographics) за сателитскиот приказ.',
        ] },
        { h: 'Лиценци', p: [
          'Користењето на овие извори е во согласност со нивните услови за користење. Сите права им припаѓаат на соодветните сопственици.',
        ] },
      ],
    },
  },

  en: {
    updatedLabel: 'Last updated',
    operatorLabel: 'Data controller',
    privacy: {
      title: 'Privacy Policy',
      sections: [
        { h: 'Introduction', p: [
          'This Privacy Policy explains how the “EkoSkopje” app collects, uses, stores and protects your personal data. The data controller is the City of Skopje. Processing is carried out in accordance with the Law on Personal Data Protection and the principles of the General Data Protection Regulation (GDPR).',
          'By using the app you confirm you have read this policy. If you do not agree, you may use the app anonymously or stop using it.',
        ] },
        { h: 'Data we collect', p: [
          'Registration data (optional): email, full name and password (stored only in encrypted/hashed form, never in plain text).',
          'Report data: location (GPS coordinates), municipality, description, category and photos you voluntarily upload.',
          'Technical data: device identifier for anonymous users, chosen language, session status and basic settings, stored locally on your device.',
          'Notifications: if you allow push notifications, a token is stored for delivering messages to your device (via Google Firebase Cloud Messaging). You can withdraw this permission at any time in your device settings.',
          'We do not collect more data than is necessary for the service to function (data minimisation).',
        ] },
        { h: 'Why we process it', p: [
          'To receive and process reports of illegal dumping, containers and pollution, and forward them to the responsible services.',
          'To display air quality and relevant notifications.',
          'To award points and maintain a leaderboard, and for anonymous statistics to improve the service.',
          'Legal basis: your consent and performance of a task in the public interest by the City of Skopje.',
        ] },
        { h: 'Photos and location', p: [
          'Camera and location access are requested only when you initiate a report and are used solely for that purpose.',
          'Please do not upload photos in which people, licence plates or other personal information of others are clearly identifiable without a basis.',
          'The report location may be visible to administrators and, in aggregated form, to the public for transparency.',
        ] },
        { h: 'Retention', p: [
          'Data is kept only as long as necessary for the purposes above or while your account exists.',
          'You can delete your account at any time directly in the app (Settings → Account → Delete account). This permanently deletes your personal data; submitted reports remain in anonymised form (no longer linked to you).',
          'Anonymous users’ data is stored locally on the device (cache) and can be deleted at any time via device settings or by clearing app data.',
        ] },
        { h: 'Sharing with third parties and processors', p: [
          'Report data may be forwarded to responsible municipal and inspection services for action.',
          'For technical operation we use processors: Vercel Inc. (app hosting), Neon Inc. (database, EU servers — Frankfurt) and Google LLC (Firebase Cloud Messaging, solely for notification delivery). These providers process data only on our instructions.',
          'We do not sell or rent personal data to third parties for marketing.',
        ] },
        { h: 'Children', p: [
          'The app is not intended for children under 16 and we do not knowingly collect their personal data. If you are a parent/guardian and believe a child has provided us personal data, contact us so we can delete it.',
        ] },
        { h: 'Your rights', p: [
          'You have the right to access, rectify, erase and restrict processing, to object, and to withdraw consent at any time.',
          'To exercise these rights contact us at the email below. You also have the right to lodge a complaint with the Personal Data Protection Agency.',
        ] },
        { h: 'Security', p: [
          'We apply appropriate technical and organisational measures (password hashing, secure communication, access control) to protect data from unauthorised access.',
        ] },
        { h: 'Contact', p: [
          'For privacy questions contact the City of Skopje at: kontakt@skopje.gov.mk',
        ] },
      ],
    },
    terms: {
      title: 'Terms of Service',
      sections: [
        { h: 'Acceptance of terms', p: [
          'By using the “EkoSkopje” app you agree to these Terms of Service. If you do not agree, please do not use the app.',
        ] },
        { h: 'Purpose of the service', p: [
          'EkoSkopje is a civic platform for reporting environmental issues (illegal dumping, containers, pollution) and monitoring air quality in the City of Skopje.',
        ] },
        { h: 'User obligations', p: [
          'Reports must be truthful and in good faith. Submitting false, offensive, misleading or malicious reports is prohibited.',
          'Uploading content that is illegal, offensive, infringes third-party rights or contains other people’s personal data without a basis is prohibited.',
          'The user is responsible for the accuracy of the data they enter.',
        ] },
        { h: 'User content', p: [
          'By uploading content you grant the City of Skopje a non-exclusive right to use it for the purposes of the service (report processing, statistics, public information).',
          'The City of Skopje reserves the right to remove content or restrict an account that violates these terms.',
        ] },
        { h: 'Community/organisation role', p: [
          'Certain verified users (organisations, communities) may publish actions and events. They are responsible for the content they publish and its accuracy.',
        ] },
        { h: 'Disclaimer', p: [
          'Air quality data comes from external sources (WAQI, pulse.eco) and is shown for information. The City of Skopje does not guarantee its absolute accuracy or availability.',
          'The service is provided “as is”, without warranties of continuity or absence of errors.',
        ] },
        { h: 'Changes to the terms', p: [
          'These terms may change from time to time. Continued use after changes means acceptance of the new terms.',
        ] },
      ],
    },
    attribution: {
      title: 'Data sources & attribution',
      sections: [
        { h: 'Air quality', p: [
          'Air quality data is provided by the World Air Quality Index (WAQI) — waqi.info and by the pulse.eco sensor network.',
          'Reference measurements come from official stations of the responsible institutions, while non-reference ones come from citizen/private sensors and are for information only.',
          'Sensor devices do not perform measurements using reference methods, and the data derived from them is exclusively for a preliminary assessment of ambient air quality.',
          'For any detailed analysis and interpretation of ambient air conditions, additional measurements are required in accordance with the legal regulations in the field of ambient air.',
        ] },
        { h: 'Map data', p: [
          'Maps and geolocation data are based on OpenStreetMap (© OpenStreetMap contributors) and reverse-geocoding services (Nominatim).',
          'Map tiles are provided by CARTO (© CARTO) and Esri World Imagery (© Esri, Maxar, Earthstar Geographics) for the satellite view.',
        ] },
        { h: 'Licences', p: [
          'Use of these sources complies with their terms of use. All rights belong to the respective owners.',
        ] },
      ],
    },
  },

  sq: {
    updatedLabel: 'Përditësuar së fundmi',
    operatorLabel: 'Kontrolluesi i të dhënave',
    privacy: {
      title: 'Politika e privatësisë',
      sections: [
        { h: 'Hyrje', p: [
          'Kjo Politikë e privatësisë shpjegon si aplikacioni “EkoSkopje” i mbledh, përdor, ruan dhe mbron të dhënat tuaja personale. Kontrolluesi i të dhënave është Qyteti i Shkupit. Përpunimi kryhet në përputhje me Ligjin për mbrojtjen e të dhënave personale dhe parimet e Rregullores së Përgjithshme për Mbrojtjen e të Dhënave (GDPR).',
          'Duke përdorur aplikacionin, konfirmoni se e keni lexuar këtë politikë. Nëse nuk pajtoheni, mund ta përdorni aplikacionin në mënyrë anonime ose të ndaloni përdorimin.',
        ] },
        { h: 'Të dhënat që mbledhim', p: [
          'Të dhëna regjistrimi (opsionale): email, emri e mbiemri dhe fjalëkalimi (i ruajtur vetëm në formë të enkriptuar/hash-uar, kurrë si tekst i qartë).',
          'Të dhëna raportimi: vendndodhja (koordinatat GPS), komuna, përshkrimi, kategoria dhe fotografitë që ngarkoni vullnetarisht.',
          'Të dhëna teknike: identifikuesi i pajisjes për përdoruesit anonimë, gjuha e zgjedhur, statusi i sesionit dhe cilësimet bazë, të ruajtura lokalisht në pajisjen tuaj.',
          'Njoftimet: nëse lejoni njoftimet push, ruhet një token për dërgimin e mesazheve në pajisjen tuaj (përmes Google Firebase Cloud Messaging). Lejen mund ta tërhiqni në çdo kohë në cilësimet e pajisjes.',
          'Nuk mbledhim më shumë të dhëna sesa është e nevojshme për funksionimin e shërbimit (minimizimi i të dhënave).',
        ] },
        { h: 'Pse i përpunojmë', p: [
          'Për të pranuar e përpunuar raportime për deponi ilegale, kontejnerë dhe ndotje, dhe për t’i përcjellë te shërbimet përgjegjëse.',
          'Për të shfaqur cilësinë e ajrit dhe njoftime relevante.',
          'Për të dhënë pikë dhe për të mbajtur renditjen, si dhe për statistika anonime për përmirësimin e shërbimit.',
          'Baza ligjore: pëlqimi juaj dhe kryerja e një detyre me interes publik nga Qyteti i Shkupit.',
        ] },
        { h: 'Fotografitë dhe vendndodhja', p: [
          'Qasja në kamerë dhe vendndodhje kërkohet vetëm kur ju nisni një raport dhe përdoret vetëm për atë qëllim.',
          'Ju lutemi mos ngarkoni fotografi ku janë qartë të dallueshme fytyra, targa ose të dhëna të tjera personale të të tjerëve pa bazë.',
          'Vendndodhja e raportit mund të jetë e dukshme për administratorët dhe, në formë të agreguar, për publikun për transparencë.',
        ] },
        { h: 'Ruajtja dhe afati', p: [
          'Të dhënat ruhen vetëm sa është e nevojshme për qëllimet e mësipërme ose derisa ekziston llogaria juaj.',
          'Llogarinë mund ta fshini në çdo kohë direkt në aplikacion (Cilësimet → Llogaria → Fshi llogarinë). Me këtë fshihen përgjithmonë të dhënat tuaja personale; raportet e paraqitura mbeten në formë të anonimizuar (pa lidhje me ju).',
          'Të dhënat e përdoruesve anonimë ruhen lokalisht në pajisje (cache) dhe mund t’i fshini në çdo kohë përmes cilësimeve të pajisjes ose duke pastruar të dhënat e aplikacionit.',
        ] },
        { h: 'Ndarja me palë të treta dhe përpunuesit', p: [
          'Të dhënat e raporteve mund t’u përcillen shërbimeve komunale dhe inspektuese përgjegjëse për veprim.',
          'Për funksionim teknik përdorim përpunues: Vercel Inc. (hostim i aplikacionit), Neon Inc. (bazë të dhënash, serverë në BE — Frankfurt) dhe Google LLC (Firebase Cloud Messaging, vetëm për dërgimin e njoftimeve). Këta ofrues i përpunojnë të dhënat vetëm sipas udhëzimeve tona.',
          'Nuk shesim dhe nuk japim me qira të dhëna personale për marketing te palët e treta.',
        ] },
        { h: 'Fëmijët', p: [
          'Aplikacioni nuk është i dedikuar për fëmijë nën 16 vjeç dhe nuk mbledhim me vetëdije të dhënat e tyre personale. Nëse jeni prind/kujdestar dhe besoni se një fëmijë na ka dhënë të dhëna personale, na kontaktoni që t’i fshijmë.',
        ] },
        { h: 'Të drejtat tuaja', p: [
          'Keni të drejtë qasjeje, korrigjimi, fshirjeje dhe kufizimi të përpunimit, të drejtë kundërshtimi dhe tërheqjeje të pëlqimit në çdo kohë.',
          'Për t’i ushtruar këto të drejta na kontaktoni në email-in më poshtë. Keni gjithashtu të drejtë ankese te Agjencia për Mbrojtjen e të Dhënave Personale.',
        ] },
        { h: 'Siguria', p: [
          'Zbatojmë masa të përshtatshme teknike dhe organizative (hash-im të fjalëkalimeve, komunikim të sigurt, kontroll qasjeje) për të mbrojtur të dhënat nga qasja e paautorizuar.',
        ] },
        { h: 'Kontakti', p: [
          'Për pyetje mbi privatësinë kontaktoni Qytetin e Shkupit në: kontakt@skopje.gov.mk',
        ] },
      ],
    },
    terms: {
      title: 'Kushtet e përdorimit',
      sections: [
        { h: 'Pranimi i kushteve', p: [
          'Duke përdorur aplikacionin “EkoSkopje” pajtoheni me këto Kushte të përdorimit. Nëse nuk pajtoheni, ju lutemi mos e përdorni aplikacionin.',
        ] },
        { h: 'Qëllimi i shërbimit', p: [
          'EkoSkopje është platformë qytetare për raportimin e problemeve mjedisore (deponi ilegale, kontejnerë, ndotje) dhe monitorimin e cilësisë së ajrit në Qytetin e Shkupit.',
        ] },
        { h: 'Detyrimet e përdoruesit', p: [
          'Raportet duhet të jenë të vërteta dhe me qëllim të mirë. Ndalohet paraqitja e raporteve të rreme, fyese, mashtruese ose keqdashëse.',
          'Ndalohet ngarkimi i përmbajtjes që është e paligjshme, fyese, që cenon të drejtat e palëve të treta ose përmban të dhëna personale të të tjerëve pa bazë.',
          'Përdoruesi është përgjegjës për saktësinë e të dhënave që fut.',
        ] },
        { h: 'Përmbajtja e përdoruesit', p: [
          'Duke ngarkuar përmbajtje, i jepni Qytetit të Shkupit të drejtë joekskluzive për ta përdorur atë për qëllimet e shërbimit (përpunim raportesh, statistika, informim publik).',
          'Qyteti i Shkupit rezervon të drejtën të heqë përmbajtje ose të kufizojë një llogari që shkel këto kushte.',
        ] },
        { h: 'Roli “komunitet/organizatë”', p: [
          'Disa përdorues të verifikuar (organizata, komunitete) mund të publikojnë aksione dhe evente. Ata janë përgjegjës për përmbajtjen që publikojnë dhe saktësinë e saj.',
        ] },
        { h: 'Kufizimi i përgjegjësisë', p: [
          'Të dhënat për cilësinë e ajrit vijnë nga burime të jashtme (WAQI, pulse.eco) dhe shfaqen për informim. Qyteti i Shkupit nuk garanton saktësinë ose disponueshmërinë absolute të tyre.',
          'Shërbimi ofrohet “ashtu siç është”, pa garanci vazhdimësie ose mungese gabimesh.',
        ] },
        { h: 'Ndryshimet e kushteve', p: [
          'Këto kushte mund të ndryshojnë herë pas here. Përdorimi i vazhdueshëm pas ndryshimeve nënkupton pranimin e kushteve të reja.',
        ] },
      ],
    },
    attribution: {
      title: 'Burimet e të dhënave dhe atribuimi',
      sections: [
        { h: 'Cilësia e ajrit', p: [
          'Të dhënat për cilësinë e ajrit ofrohen nga World Air Quality Index (WAQI) — waqi.info dhe nga rrjeti i sensorëve pulse.eco.',
          'Matjet referente vijnë nga stacionet zyrtare të institucioneve përgjegjëse, ndërsa ato jo-referente vijnë nga sensorë qytetarë/privatë dhe janë vetëm për informim.',
          'Pajisjet e sensorëve nuk kryejnë matje sipas metodave referente dhe të dhënat e nxjerra prej tyre janë ekskluzivisht për vlerësimin paraprak të cilësisë së ajrit ambient.',
          'Për çdo analizë dhe interpretim të detajuar të gjendjeve të ajrit ambient nevojiten matje shtesë sipas rregullores ligjore në fushën e ajrit ambient.',
        ] },
        { h: 'Të dhënat hartografike', p: [
          'Hartat dhe të dhënat e gjeolokacionit bazohen në OpenStreetMap (© OpenStreetMap contributors) dhe shërbimet e gjeokodimit të kundërt (Nominatim).',
          'Pllakëzat e hartës sigurohen nga CARTO (© CARTO) dhe Esri World Imagery (© Esri, Maxar, Earthstar Geographics) për pamjen satelitore.',
        ] },
        { h: 'Licencat', p: [
          'Përdorimi i këtyre burimeve është në përputhje me kushtet e tyre të përdorimit. Të gjitha të drejtat u përkasin pronarëve përkatës.',
        ] },
      ],
    },
  },
}
