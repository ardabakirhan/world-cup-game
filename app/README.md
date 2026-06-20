# WC26 Manager — 2026 Dünya Kupası Teknik Direktörlük Oyunu

Football Agent tarzı, tamamen **offline**, metin/liste tabanlı menajerlik oyunu.
48 takım × 26 oyuncu, gerçek 2026 kadroları + EA FC 26 statları (`src/data/teams.json`).

## Stack

Vite + React 19 + TypeScript · zustand (persist → Capacitor Preferences) ·
react-router (Hash) · i18next (TR/EN) · Tailwind CSS 4 · Capacitor 8 (Android)

## Komutlar

```bash
npm install
npm run dev            # tarayıcıda geliştirme (http://localhost:5173)
npm run build          # tsc + vite build → dist/
npm run android        # build + sync + Android Studio'da aç
npm run apk            # build + sync + debug APK üret (gradle)

npx tsx scripts/calibrate.ts        # motor kalibrasyonu (1000 maç + 20 turnuva)
npx tsx scripts/playthrough.ts TUR  # store üzerinden tam kariyer testi
```

Debug APK çıktısı: `android/app/build/outputs/apk/debug/app-debug.apk`

> Gradle, JDK 21 ister (Capacitor 8). `android/gradle.properties` içindeki
> `org.gradle.java.home` Android Studio'nun gömülü JBR 21'ine işaret eder;
> kendi JDK 21 kurulumun varsa orayı güncelle.

## Mimari

```
src/
  data/         teams.json + tipler + takım renkleri
  domain/
    tournament/ fikstür (12 grup), puan durumu, Son 32 bracket (en iyi 8 üçüncü)
    engine/     dakika-dakika maç motoru (MatchSim) — tüm ayarlar TUNING sabitinde
    events/     hazırlık günü anlatı olayları (16 olay, 2'şer seçenek)
    player/     form/moral/yorgunluk/kart-ceza kuralları
    ai/         AI ilk 11 + taktik seçimi (diğer 47 takım)
  store/        zustand store: gün ilerletme, maç commit, bracket ilerleyişi, kayıt
  screens/      TeamSelect, Home, Squad, PlayerDetail, Tactics, MatchLive, Tournament, Summary
  i18n/         tr.json / en.json (UI + maç anlatımı + olay metinleri)
```

### Oyun döngüsü

19 oyun günü: 2 hazırlık günü + maç günü ritmiyle grup maçları (G1-G3),
ardından Son 32 → Son 16 → ÇF → YF → Final. Hazırlık günlerinde 1 aksiyon
(antrenman/dinlenme/konuşma/basın) + olasılıkla 1 anlatı olayı (2 seçenekli karar).
Maçlar dakika dakika izlenir (1x/2x/atla), 3 pencere + devre arasında 5 değişiklik,
taktik her duraklamada değiştirilebilir. Diğer tüm maçlar aynı motorla simüle edilir.

### Maç motoru kalibrasyonu (1000 maç)

- 2.52 gol/maç, %21.8 beraberlik
- Favori kazanma oranı (sonuçlanan maçlarda): OVR farkı 0-2 → %55, 3-5 → %72, 6-9 → %82, 10+ → %91

### Bilinçli sadeleştirmeler

- Takvim, turnuva turu başına tek "maç günü"ne sıkıştırıldı (19 oyun günü)
- Üçüncülerin Son 32 slot dağıtımı: FIFA'nın 495 kombinasyonluk resmi tablosu yerine
  "aynı grupla erken rövanş yok" kısıtlı atama
- Grup içi tiebreak: puan → averaj → atılan gol → ikili maç sonucu
