# 2026 Dünya Kupası Veri Toplama — Özet Rapor

*Üretim tarihi: 2026-06-11 · İkinci tur (FC25/FC24) güncellemesi aynı gün*

## İkinci Tur Eşleştirme (FC 25 + FC 24)

FC 26'da bulunamayan 300 oyuncu, FC 25 ([aniss7 sofifa dump'ı, Haz 2025](https://www.kaggle.com/datasets/aniss7/fifa-player-data-from-sofifa-2025-06-03))
ve FC 24 ([stefanoleone992](https://www.kaggle.com/datasets/stefanoleone992/ea-sports-fc-24-complete-player-dataset))
veritabanlarında arandı (`second_pass.py`). Eşleştirme yalnızca DOB + isim üzerinden yapıldı
(kulüp KULLANILMADI — transferler), ek güvence olarak **milliyet = milli takım** şartı eklendi
(tam isim uyumu istisnasıyla; bu şart "Hamrobekov→John", "Brian Rodríguez→Rodri" gibi
3 yanlış pozitifi yakaladı).

**Sonuç: FC26 948 + FC25 40 + FC24 36 = 1.024 gerçek rating (%82,1) · kalan 224 tahmini**

- FC25'ten gelenler: ağırlıkla Liga MX (FC 26'dan çıkmıştı) — Ochoa, Romo, Chávez...
- FC24'ten gelenler: 2023 sonrası Brezilya/Rusya'ya transfer olanlar — **Neymar (89 OVR, Al Hilal)**,
  Alex Sandro, de la Cruz, Viña...
- FC24 kaynaklı 30+ yaş oyunculara yıpranma düzeltmesi: pace −3, physical −2
  (Neymar: pace 86→83)
- FC25 dump'ının bilinen kusurları ele alındı: sahte Brezilya ligi filtrelendi,
  "65+2" stat formatı parse edildi, eksik detay sayfalarında ana statlar pozisyon
  şablonuyla gerçek overall'a oturtuldu, `country_name` alanına sızan
  "Friendly International" değeri yoksayıldı.

**Yeni tahmin kuralı** (224 oyuncu): %87,5-takım-ortalaması yerine
yaklaşık FIFA sıralamasına göre taban (`79 − 0.22×sıra`, 62-79 bandı) +
milli maç bonusu (100+ cap → +5, 50+ → +3, 25+ → +1.5). Böylece ülke kaptanları
artık 65 OVR değil: Nagatomo (145 cap) 78, James Rodríguez (126 cap) 80,
Enner Valencia 77, Beiranvand 77. `"source"` alanı her oyuncuda mevcut:
`FC26 | FC25 | FC24 | estimate`.

**Sanity check:** Neymar gerçek FC24 ratingiyle geldi (89, dribbling 93) ✓ ·
Meksika kadro ortalaması 75,4 (hedef bandın içinde, 21/26 gerçek veri) ✓ ·
`validate.py` issues: 0 ✓

---

## Çıktılar

| Dosya | İçerik |
|---|---|
| `teams.json` | 48 takım × 26 oyuncu = 1.248 oyuncu, istenen şemada |
| `unmatched_players.json` | FC 26'da bulunamayan 300 oyuncu (istatistikleri tahmin edildi) |
| `match_log.json` | 948 eşleşmenin tamamı: kaynak isim/kulüp/DOB + yöntem (denetim için) |
| `build_dataset.py` | Tüm pipeline (yeniden çalıştırılabilir; kaynak dosyalar cache'lenir) |
| `validate.py`, `audit_matches.py`, `analyze_unmatched.py` | Doğrulama/denetim araçları |

## Veri Kaynakları

1. **FIFA resmi API** (`api.fifa.com/api/v3`) — fifa.com takımlar sayfasının arkasındaki API bulundu:
   - Kadrolar: `teams/squads/all/17/285023` (idCompetition=17, idSeason=285023 = FWC 2026)
   - Gruplar: `calendar/matches?idCompetition=17&idSeason=285023` (grup maçlarından türetildi)
2. **Wikipedia** "2026 FIFA World Cup squads" — kulüp, milli maç (caps) ve gol sayıları
   (FIFA API'sinde bu alanlar null). İki kaynak forma numarası + doğum tarihiyle çapraz doğrulandı.
3. **EA FC 26 oyuncu veritabanı** — sofifa kaynaklı hazır dataset
   ([EAFC26-DataHub](https://github.com/ismailoksuz/EAFC26-DataHub), 18.405 oyuncu,
   güncelleme #4, 19 Eyl 2025). Sofifa.com Cloudflare arkasında olduğu için scrape edilmedi;
   ikinci bir Kaggle dataset'i ([flynn28/eafc26-player-database](https://www.kaggle.com/datasets/flynn28/eafc26-player-database))
   ile kapsam çapraz kontrol edildi.

## Doğrulama

- ✅ 48 takım, 12 grup (A–L) × 4 takım, konfederasyonlar: UEFA 16, CAF 10, AFC 9, CONCACAF 6, CONMEBOL 6, OFC 1
- ✅ Her takımda tam 26 oyuncu, forma numaraları 1–26, en az 3 kaleci
- ✅ Eksik alan yok: tüm oyuncularda overall, doğum tarihi, kulüp; tüm kalecilerde gkStats (`validate.py` → issues: 0)
- ✅ Mantık kontrolü — en çok milli maç: Ronaldo 227, Messi 199, Modrić 198
- ✅ Wikipedia'da eksik olan 2 oyuncu (Balerdi, Baumgartner) FIFA API'den tamamlandı

### En yüksek 20 overall
91 Salah (EGY), 91 Mbappé (FRA), 90 Van Dijk (NED), 90 Rodri (ESP), 90 Dembélé (FRA),
90 Bellingham (ENG), 90 Haaland (NOR), 89 Vitinha (POR), 89 Vinícius Jr (BRA),
89 Courtois (BEL), 89 Raphinha (BRA), 89 Pedri (ESP), 89 Lamine Yamal (ESP),
89 Kimmich (GER), 89 Kane (ENG), 89 Wirtz (GER), 89 Valverde (URU), 89 Alisson (BRA),
89 Hakimi (MAR), 88 Lautaro Martínez (ARG)

## Eşleşme Oranı: %76,0 (948/1248) — %90 hedefi neden yapısal olarak imkânsız

Kalan 300 oyuncu eşleştirme hatası değil; **FC 26 oyununda gerçekten yoklar.**
İki bağımsız FC 26 dataset'iyle doğrulandı:

- **Liga MX FC 26'da yok** (lisans çıkmış) → Meksika kadrosunun yarısı + América/Tijuana/León'daki yabancılar
- **Brezilya Série A sahte isimli** (EA'in oyuncu isim lisansı yok; kadrolar "Oswaldinato" gibi kurgu
  oyunculardan oluşuyor, hepsi 29 Şubat doğumlu) → Neymar (Santos), Flamengo/Palmeiras'taki herkes
- **Rusya Premier Ligi FC23'ten beri yok** → Zenit, Krasnodar, Spartak oyuncuları
- **Lisanssız yerel ligler**: İran, Ürdün, Özbekistan, Güney Afrika, Mısır, Irak, Katar, Panama,
  Haiti, Yeşil Burun, Tunus, J-League (Japonya), Sırbistan, Kıbrıs (kısmi)
- **Serbest oyuncular** DB'de yok (örn. Tomiyasu — Eylül 2025'te kulüpsüzdü)

En çok etkilenen takımlar: İran 24/26, Ürdün 24/26, Özbekistan 23/26, G. Afrika 21/26, Mısır 21/26.
Avrupa takımları + Arjantin/Brezilya çekirdeği için gerçek veri oranı %95+.

Eşleşmeyenlerin istatistikleri spesifikasyona göre tahmin edildi: aynı takımdaki aynı mevkideki
eşleşmiş oyuncuların ortalamasının %87,5'i (takımda o mevkide eşleşen yoksa tüm takımın %80'i),
`"estimated": true` bayrağıyla. Mohamed Salah gibi yıldızlar Avrupa kulüplerinde olduğundan
gerçek veriyle geldi; tahminler ağırlıkla 60-72 OVR bandında alt sıra oyuncular.

## Eşleştirme Yöntemi (948 gerçek eşleşme)

| Yöntem | Adet |
|---|---|
| Doğum tarihi birebir + fuzzy isim (eşik 72) | 469 |
| Normalize isim birebir + DOB doğrulama | 461 |
| Milliyet havuzu + güçlü fuzzy (≥86/95) + kulüp doğrulama | 5 |
| DOB ±5 gün + güçlü fuzzy (≥85) — dump'taki tarih hataları için | 5 |
| İsim birebir + kulüp doğrulama | 4 |
| Diğer (DOB+kulüp, forma+mevki, doğrulanamayan birebir) | 4 |

Önemli uygulama detayları:
- Unicode normalizasyonu: aksan temizliği + sofifa'nın uzun isimlere yapıştırdığı
  Arapça/Korece yazımların atılması ("Titraouiياسين" sorunu)
- Tek kelimelik isimlerde ("Rayan", "Zizo") fuzzy eşiği 95'e çıkarıldı — yanlış pozitif önlemi
- Kısa kulüp adlarında partial_ratio devre dışı ("AEL" ≠ "Arsenal")
- Sahte Brezilya ligi satırları index'ten tamamen çıkarıldı
- 36 riskli eşleşmenin tamamı elle denetlendi (`audit_matches.py`), 16 yanlış pozitif giderildi
