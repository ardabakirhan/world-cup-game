/** Pre-written Turkish player interaction event pool. */

export type InteractionTrigger =
  | 'benchedAndWon'
  | 'benchedAndLost'
  | 'benchedThreeMatches'
  | 'captainPoorMatch'
  | 'youngPlayerFirstCap'
  | 'threeMatchLosingStreak'
  | 'starPlayerGoodForm'

export interface InteractionChoice {
  text: string
  effect: {
    morale?: number
    relationship?: number
    teamMorale?: number
    mustStartNext?: boolean
    discipline?: number
  }
}

export interface PlayerInteraction {
  dialogue: string
  options: InteractionChoice[]
}

/** Replace [PLAYER] with actual player name at render time. */
export const PLAYER_INTERACTION_POOL: Record<InteractionTrigger, PlayerInteraction[]> = {
  benchedAndWon: [
    {
      dialogue: '[PLAYER] soyunma odasında köşeye çekiyor seni: "Hoca, kazandık tamam da... ben ne zaman oynayacağım yani?"',
      options: [
        { text: 'Anlayışla karşıla, planını anlat', effect: { morale: 2, relationship: 1 } },
        { text: 'Sert ol, rekabeti hatırlat', effect: { morale: -3, relationship: -2, discipline: 1 } },
        { text: 'Söz ver: bir sonraki maçta başlıyorsun', effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] soyunma odasından çıkarken duraksıyor: "Hoca, ben hazırım. Sadece bir şans istiyorum."',
      options: [
        { text: 'Planını açıkla, sabrını takdir et', effect: { morale: 1, relationship: 1 } },
        { text: '"Performansın yeterli değil şu an"', effect: { morale: -4, relationship: -3 } },
        { text: 'Gelecek maçta oynayacaksın, söz', effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] gülümsemeye çalışıyor ama yüzü her şeyi ele veriyor: "Güzel galibiyet... Keşke ben de sahadaydım."',
      options: [
        { text: 'Takım başarısı her şeyden önemli', effect: { morale: 1, relationship: 0 } },
        { text: 'Anlıyorum, sıran yakında gelecek', effect: { morale: 2, relationship: 1 } },
        { text: 'Söz veriyorum, bir sonraki maç senin', effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] yanına geliyor: "Hoca, bir şey sormak istiyorum. Neden beni oynatmıyorsunuz?"',
      options: [
        { text: 'Sakin bir şekilde açıkla', effect: { morale: 2, relationship: 1 } },
        { text: '"Önce antrenmanlarda fark yarat"', effect: { morale: -2, relationship: -1 } },
        { text: 'Bir sonraki maçta başlatacağım', effect: { mustStartNext: true, relationship: 3 } },
      ],
    },
    {
      dialogue: '[PLAYER] duştan çıkarken: "Hoca, tribünden izlemek çok zor ya. Gerçekten oynamak istiyorum."',
      options: [
        { text: 'Sabret, zamanın gelecek', effect: { morale: 2, relationship: 1 } },
        { text: '"Herkes bekliyor, sen de bekleyeceksin"', effect: { morale: -2, relationship: -2 } },
        { text: 'Söz ver, gelecek maçta oynarsın', effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] antrenman çantasını bırakırken: "Kazanıyoruz ama... ben ne işe yarıyorum ki?"',
      options: [
        { text: 'Takımdaki değerini anlat', effect: { morale: 3, relationship: 2 } },
        { text: '"Rekabet var, kabul etmek zorundasın"', effect: { morale: 0, relationship: 0 } },
        { text: 'Gelecek maçta başlayacaksın, söz', effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] sana doğrudan bakıyor: "Hoca, açık soruyorum: bana güveniyor musunuz?"',
      options: [
        { text: '"Evet, planında varsın"', effect: { morale: 4, relationship: 2 } },
        { text: '"Güven sahada kazanılır"', effect: { morale: -1, relationship: -1 } },
        { text: 'Gelecek maçta başlatacağım, söz', effect: { mustStartNext: true, relationship: 3 } },
      ],
    },
    {
      dialogue: '[PLAYER] takım kutlamasına katılmıyor, kenarda tek başına oturuyor. Yanına gittiğinde: "Özür dilerim hoca, moralim biraz düşük."',
      options: [
        { text: 'Omzuna vur ve destek ver', effect: { morale: 4, relationship: 3 } },
        { text: '"Takımla kutla, bu davranış doğru değil"', effect: { morale: -1, relationship: -1 } },
        { text: 'Söz ver: bir sonraki maçta sahadasın', effect: { mustStartNext: true, relationship: 3 } },
      ],
    },
  ],

  benchedAndLost: [
    {
      dialogue: '[PLAYER] soyunma odasında seni köşeye çekiyor: "Hoca... Sahadaydım belki fark yaratabilirdim. Bunu düşündünüz mü?"',
      options: [
        { text: 'Haklısın, bir sonraki maçta başlıyorsun', effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: '"Kararlarıma güvenmenizi istiyorum"', effect: { morale: -2, relationship: -1 } },
        { text: '"Bu tutum kabul edilemez, konuşmayacağım"', effect: { morale: -5, relationship: -3, discipline: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] öfkeli ama kendini tutmaya çalışıyor: "Hoca, kaybettik. Ve ben hiç oynamadım. Bu mantıklı mı?"',
      options: [
        { text: 'Sakin ol, açıklayayım', effect: { morale: 1, relationship: 0 } },
        { text: 'Bir sonraki maçta kendin kanıtla', effect: { mustStartNext: true, relationship: 1 } },
        { text: '"Bu tutum seni daha uzun yedekte tutar"', effect: { morale: -4, relationship: -4, discipline: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] gözleri dolmuş: "Hoca, üzüldüm. Hem kaybettik hem de hiç katkı sunamadım."',
      options: [
        { text: 'Yanında dur ve destekle', effect: { morale: 3, relationship: 2 } },
        { text: 'Bir sonraki maçta oynarsın, söz', effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: '"Takım işi bu, hepimiz katıldık"', effect: { morale: 0, relationship: 0 } },
      ],
    },
    {
      dialogue: '[PLAYER] sana yaklaşıyor: "Hoca, bir konuşabilir miyiz? Neden ben oynamıyorum, üstelik kaybettik."',
      options: [
        { text: 'Kapsamlı bir konuşma yap', effect: { morale: 3, relationship: 3 } },
        { text: '"Taktik karar, daha fazla açıklayamam"', effect: { morale: 0, relationship: 0 } },
        { text: '"Şu an uygun değil, yarın konuşuruz"', effect: { morale: -3, relationship: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] dolap başında oturup kimseyi dinlemiyor: "Bu yenilgi gereksizdi. Ben oynasaydım..."',
      options: [
        { text: '"Bir takımız, bu lafı kapat"', effect: { morale: -2, discipline: 2, relationship: -2 } },
        { text: 'Gelecek maçta oynayacaksın', effect: { mustStartNext: true, relationship: 2, morale: 2 } },
        { text: 'Baş başa bir konuşalım', effect: { morale: 2, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] soyunma odasından çıkarken: "Hoca, bir dahakine beni oynatsanız iyi olur."',
      options: [
        { text: 'Söz veriyorum', effect: { mustStartNext: true, relationship: 2, morale: 2 } },
        { text: '"Rekabet normal, sıran gelecek"', effect: { morale: 0, relationship: 0 } },
        { text: '"Böyle talep edilmez"', effect: { morale: -3, relationship: -3, discipline: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] sakin ama kararlı: "Hoca, yedekte oturarak kaybetmek ikiye katlanıyor. Bir şans bekliyorum."',
      options: [
        { text: 'Anlıyorum, bir sonraki maç senin', effect: { morale: 4, relationship: 3, mustStartNext: true } },
        { text: '"Sabırlı ol, zamanın gelecek"', effect: { morale: 1, relationship: 0 } },
        { text: '"Şansını antrenmanda kazan"', effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sessizce yanına gelip oturuyor: "Hoca... bu böyle olmak zorunda mıydı?"',
      options: [
        { text: 'Açıkla ve gelecek maç için söz ver', effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: '"Evet, bugünkü en iyi karardı"', effect: { morale: -1, relationship: -1 } },
        { text: '"Biraz dinlen, yarın konuşuruz"', effect: { morale: 1, relationship: 1 } },
      ],
    },
  ],

  benchedThreeMatches: [
    {
      dialogue: '[PLAYER] artık sabredemez: "Hoca, üç maçtır oturmaktan bıktım. Bana güvenmiyorsanız söyleyin, kulübüme döneceğim."',
      options: [
        { text: '"Planında yerin var, biraz daha sabret"', effect: { morale: 1, relationship: 1 } },
        { text: '"Rekabet var, bu normal futbol"', effect: { morale: -2, relationship: -2 } },
        { text: 'Söz veriyorum, gelecek maçta oynarsın', effect: { mustStartNext: true, relationship: 3, morale: 3 } },
      ],
    },
    {
      dialogue: '[PLAYER] menajerine mesaj attığını ima ediyor: "Üç maçtır yedekteyim. Bir çözüm gerekiyor."',
      options: [
        { text: 'Planını açıkla ve oynayacağına söz ver', effect: { mustStartNext: true, relationship: 2, morale: 2 } },
        { text: '"Takım kararlarına saygı göster"', effect: { morale: -1, relationship: -1 } },
        { text: '"Bu yol seni daha kötü yere götürür"', effect: { morale: -4, relationship: -4, discipline: 3 } },
      ],
    },
    {
      dialogue: '[PLAYER] direkt söylüyor: "Hoca, üç maçtır oturmak yeter. Ya beni oynatsanız ya da açıkça konuşalım."',
      options: [
        { text: 'Bir sonraki maçta başlıyorsun, söz', effect: { mustStartNext: true, relationship: 2, morale: 2 } },
        { text: '"Kararlarım değişmez"', effect: { morale: -3, relationship: -2 } },
        { text: '"Bu tavır ceza gerektirir"', effect: { morale: -5, relationship: -5, discipline: 4 } },
      ],
    },
    {
      dialogue: '[PLAYER] gözleri üzgün: "Hoca, üç maçtır tribünden seyrediyorum. Bir fırsat verin, hayal kırıklığı yaratmam."',
      options: [
        { text: 'Yanında dur ve söz ver', effect: { morale: 4, relationship: 3, mustStartNext: true } },
        { text: '"Sıran gelecek, sabret"', effect: { morale: 1, relationship: 0 } },
        { text: '"Önce antrenmanda fark yarat"', effect: { morale: -2, relationship: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] takım arkadaşlarına şikayetini duyurmuş. Herkes konuşuyor: "Hiçbir açıklama yok."',
      options: [
        { text: 'Özel konuşma yap ve oynayacağına söz ver', effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: '"Şikayetini soyunma odasına taşıma"', effect: { morale: -3, relationship: -3, discipline: 2 } },
        { text: '"Bir daha olursa resmi uyarı yazarım"', effect: { morale: -5, relationship: -5, discipline: 5 } },
      ],
    },
    {
      dialogue: '[PLAYER] sana bakıyor: "Hoca, dürüst ol benimle. Planımda gerçekten var mıyım?"',
      options: [
        { text: '"Evet varsın. Ve gelecek maç senidir"', effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: '"Takım rekabeti her zaman var"', effect: { morale: 0, relationship: 0 } },
        { text: '"Bunu sormana gerek yok"', effect: { morale: -2, relationship: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] antrenmanlara isteksiz geliyor. Üç maçlık yedeklik onu olumsuz etkiliyor.',
      options: [
        { text: 'Baş başa otur, konuşun ve çöz', effect: { morale: 4, relationship: 3, mustStartNext: true } },
        { text: '"Disiplin kuralları herkese eşit uygulanır"', effect: { morale: -3, relationship: -3, discipline: 3 } },
        { text: '"Sezon uzun, sıranı bekle"', effect: { morale: 2, relationship: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] yanına gelip oturuyor: "Hoca, neden oynatmıyorsunuz? Gerçekten anlamak istiyorum."',
      options: [
        { text: 'Detaylı açıklama yap', effect: { morale: 2, relationship: 2 } },
        { text: 'Söz ver ve güven ver', effect: { mustStartNext: true, relationship: 3, morale: 3 } },
        { text: '"Şu an doğru zaman değil, konuşuruz"', effect: { morale: -3, relationship: -2 } },
      ],
    },
  ],

  captainPoorMatch: [
    {
      dialogue: 'Kaptan [PLAYER] soyunma odasında ayağa kalkıyor: "Arkadaşlar, bu benim hatam. Ben toparlayacağım bu takımı."',
      options: [
        { text: '"Sana güveniyorum, çözersin"', effect: { morale: 3, teamMorale: 2 } },
        { text: '"Hep beraber toparlayacağız"', effect: { morale: 1, teamMorale: 1 } },
        { text: '"Kaptanlığını gözden geçireceğim"', effect: { morale: -5, relationship: -4 } },
      ],
    },
    {
      dialogue: '[PLAYER] sana geliyor: "Hoca, bugün liderlik yapamadım. Bir dahakine farklı olacak, söz."',
      options: [
        { text: 'Güven ver ve destekle', effect: { morale: 3, relationship: 2, teamMorale: 1 } },
        { text: '"Haklısın, daha güçlü liderlik gerek"', effect: { morale: 1, relationship: 0 } },
        { text: '"Kaptanlığını gözden geçiririm"', effect: { morale: -3, relationship: -3 } },
      ],
    },
    {
      dialogue: 'Kaptan [PLAYER] takım adına seninle konuşuyor: "Hoca, özür dileriz. Bu bizim hatamız."',
      options: [
        { text: 'Liderliğini alenen takdir et', effect: { morale: 4, relationship: 2, teamMorale: 2 } },
        { text: '"Söz değil, eylem görmek istiyorum"', effect: { morale: 1, relationship: 0 } },
        { text: 'Hataları beraber analiz et', effect: { morale: 2, teamMorale: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sessiz soyunma odasını ayağa kaldırıyor: "Arkadaşlar! Bir maç kaybettik. Hepsi bu. Kalkacağız."',
      options: [
        { text: 'Liderliğini destekle', effect: { morale: 4, teamMorale: 3 } },
        { text: '"Sen yönet, ben arkandan gelirim"', effect: { morale: 2, teamMorale: 2 } },
        { text: '"Güzel söz, eylemle göster"', effect: { morale: -2, relationship: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] seninle baş başa: "Hoca, hem takımı toparlayacağım hem de kendim daha iyi oynayacağım. İkisini de yapabilirim."',
      options: [
        { text: '"Bu dürüstlüğe saygı duyuyorum"', effect: { morale: 2, relationship: 2 } },
        { text: '"Şimdi takıma odaklan"', effect: { morale: 1, teamMorale: 1 } },
        { text: '"İkisini birden zor, dikkatli ol"', effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: 'Kaptan [PLAYER] antrenmana herkesten erken geliyor ve takım için plan hazırlıyor. Fark ediyorsun.',
      options: [
        { text: 'Tüm takım önünde takdir et', effect: { morale: 4, teamMorale: 3, relationship: 2 } },
        { text: 'Özel olarak teşekkür et', effect: { morale: 2, relationship: 1 } },
        { text: '"Bu fazla, normal kal"', effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: '[PLAYER] yavaşça: "Hoca, bu takım benden daha iyisini hak ediyor. Ben de daha iyisini yapabilirim."',
      options: [
        { text: '"Bu öz eleştiri seni güçlü kılar"', effect: { morale: 4, teamMorale: 2, relationship: 2 } },
        { text: '"Doğru, birlikte çalışalım"', effect: { morale: 2, relationship: 1 } },
        { text: '"Bu düşünce seni içten çökertir"', effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: 'Kaptan [PLAYER]: "Hoca, soyunma odası toplantısı yapabilir miyiz? Ben yönetirim."',
      options: [
        { text: '"Evet, sen yönet, arkadasın"', effect: { morale: 3, teamMorale: 3, relationship: 2 } },
        { text: '"Ben yönetirim, sen yanımda ol"', effect: { morale: 1, teamMorale: 2 } },
        { text: '"Gerek görmüyorum"', effect: { morale: -2, relationship: -1 } },
      ],
    },
  ],

  youngPlayerFirstCap: [
    {
      dialogue: '[PLAYER] gözleri parlayarak koşuyor yanına: "Hoca! İlk maçım! İnanamıyorum buna!"',
      options: [
        { text: '"Gurur duyuyorum, böyle devam"', effect: { morale: 5, relationship: 3 } },
        { text: '"Güzel ama bu sadece başlangıç"', effect: { morale: 2, relationship: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sana sarılmak için koşuyor: "Hoca, teşekkürler! Bu... bu her şeydi benim için!"',
      options: [
        { text: 'Sarıl ve tebrik et', effect: { morale: 6, relationship: 4, teamMorale: 1 } },
        { text: '"Tebrikler, ama mütevazı kal"', effect: { morale: 3, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] heyecandan elleri hafif titriyor: "Ailem tribündeydi hoca. Onlar için her şeyimi verdim."',
      options: [
        { text: '"Ailenle gurur duyabilirsin"', effect: { morale: 5, relationship: 3 } },
        { text: '"Her maçta bu ruhu istiyorum"', effect: { morale: 4, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] biraz utangaç: "Hoca... çok heyecanlandım. Umarım hayal kırıklığı yaratmamışımdır."',
      options: [
        { text: '"Harika oynadın, gurur duydum"', effect: { morale: 6, relationship: 3 } },
        { text: '"İyi başlangıç, daha iyisini yapacaksın"', effect: { morale: 3, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] diğer oyuncularla kutlanırken sana dönüyor: "Hoca, bu an için saatlerce çalıştım."',
      options: [
        { text: '"Emek her zaman karşılık bulur"', effect: { morale: 5, relationship: 3 } },
        { text: '"Bu sadece başlangıç, devam et"', effect: { morale: 4, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] telefona bakıyor, gülümsüyor: "Annem mesaj atmış hoca: Seni gördüm, ağladım."',
      options: [
        { text: '"Geleceğine inanıyorum"', effect: { morale: 6, relationship: 4 } },
        { text: '"Takım için oyna, o zaman herkes mutlu"', effect: { morale: 3, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] sahadan çıkarken gözleri doluyor: "Özür dilerim hoca. Çok duygusalım şu an."',
      options: [
        { text: '"Ağlamak utanılacak bir şey değil"', effect: { morale: 5, relationship: 4 } },
        { text: '"Bu his güç kaynağın olsun"', effect: { morale: 4, relationship: 3 } },
      ],
    },
    {
      dialogue: '[PLAYER] annesini arıyor, duyuyorsun: "Anne! Oynadım! Milli maç!" Sonra utanarak sana bakıyor.',
      options: [
        { text: 'Gül ve yanında dur', effect: { morale: 6, relationship: 4, teamMorale: 1 } },
        { text: '"Güzel, o enerjiyi sahaya taşı"', effect: { morale: 4, relationship: 2 } },
      ],
    },
  ],

  threeMatchLosingStreak: [
    {
      dialogue: 'Kaptan [PLAYER] oyuncular adına sana geliyor: "Hoca, bir toplantı yapmalıyız. Bir şeyler yanlış gidiyor."',
      options: [
        { text: 'Haklısın, hemen yapalım', effect: { morale: 4, teamMorale: 3 } },
        { text: '"Ben hallederim, güvenin bana"', effect: { morale: -1, relationship: -1 } },
        { text: '"Daha çok antrenman yapacağız"', effect: { teamMorale: -1, morale: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] soyunma odasında ayağa kalkıyor: "Üç maçtır kaybediyoruz arkadaşlar. Bu takım bu değiliz."',
      options: [
        { text: 'Liderliğini destekle', effect: { morale: 3, teamMorale: 3, relationship: 1 } },
        { text: '"Doğru, planımızı değiştireceğiz"', effect: { morale: 1, teamMorale: 1 } },
        { text: '"Sen de analizi yap"', effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sana geliyor: "Hoca, takımda bir özgüven sorunu var. Ne yapabiliriz?"',
      options: [
        { text: 'Birlikte çözüm bul', effect: { morale: 4, teamMorale: 3 } },
        { text: '"Ben planı belirlerim"', effect: { morale: 1, teamMorale: 0 } },
        { text: '"Bu geçer, sürece güven"', effect: { morale: 0, teamMorale: -1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sessiz soyunma odasını işaret ediyor: "Hoca, bir konuşma yapar mısınız? Takımın buna ihtiyacı var."',
      options: [
        { text: 'Güçlü bir konuşma yap', effect: { teamMorale: 5, morale: 2 } },
        { text: '"Sen yap, zaten kaptansın"', effect: { morale: 2, relationship: 2, teamMorale: 2 } },
        { text: '"Kelimeler değil sonuçlar konuşur"', effect: { teamMorale: -1, morale: -1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sesi biraz titrek: "Hoca, takım olarak bir şeyleri kaybettik. Nasıl geri alabiliriz?"',
      options: [
        { text: 'Takım aktivitesi planla', effect: { teamMorale: 4, morale: 3 } },
        { text: 'Soyunma odası toplantısı yap', effect: { teamMorale: 3, morale: 2 } },
        { text: '"Daha çok çalışarak"', effect: { teamMorale: -1, morale: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] kapını çalıyor: "Hoca, oyuncular seninle konuşmak istiyor. Açık kapı toplantısı olabilir mi?"',
      options: [
        { text: 'Şimdi yapalım, kapılar açık', effect: { teamMorale: 4, morale: 3, relationship: 2 } },
        { text: '"Yarın organize ederiz"', effect: { teamMorale: 1, morale: 1 } },
        { text: '"Gerek görmüyorum, odaklanın"', effect: { teamMorale: -2, morale: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] sessiz duran takım arkadaşlarını gösteriyor: "Hoca, herkes bezgin. Bir şeyler yapalım."',
      options: [
        { text: 'Takım yemeği organize et', effect: { teamMorale: 5, morale: 3 } },
        { text: 'Video analiz toplantısı yap', effect: { teamMorale: 2, morale: 1 } },
        { text: '"Antrenmanla çözülür"', effect: { teamMorale: -1, morale: -1 } },
      ],
    },
    {
      dialogue: '[PLAYER] omuzları düşük: "Hoca, ben ne yapabilirim sizin için? Söyleyin, yaparım."',
      options: [
        { text: '"Takıma liderlik et"', effect: { morale: 4, teamMorale: 3, relationship: 2 } },
        { text: '"İyi oyna, o yeter"', effect: { morale: 2, teamMorale: 1 } },
        { text: '"Şimdilik dinle ve izle"', effect: { morale: 1, teamMorale: 1 } },
      ],
    },
  ],

  starPlayerGoodForm: [
    {
      dialogue: '[PLAYER] antrenmandan çıkarken rahat adımlarla: "Hoca, şu an çok iyi hissediyorum. Kimse durduramaz bizi."',
      options: [
        { text: '"Bu enerjiyi takıma ver"', effect: { teamMorale: 3, morale: 1 } },
        { text: '"Güzel ama mütevazı kalmaya devam"', effect: { morale: -1, relationship: 0 } },
      ],
    },
    {
      dialogue: '[PLAYER] sırıtarak: "Hoca, formum çok iyi. Bu tempoyu korursam şampiyonluğa gidiyoruz."',
      options: [
        { text: '"Bunu takıma da söyle"', effect: { morale: 3, teamMorale: 2 } },
        { text: '"Devam et, kazanacağız"', effect: { morale: 2, teamMorale: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] bağırıyor: "Hoca! Bu hafta müthiş hissediyorum! Vay be!"',
      options: [
        { text: '"O enerjiyi takıma yay"', effect: { teamMorale: 3, morale: 2 } },
        { text: '"Güzel, sahaya bırak onu"', effect: { morale: 2, relationship: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sakin ama özgüvenli: "Hoca, son birkaç maçım çok iyiydi. Daha fazlasını yapabilirim."',
      options: [
        { text: 'Liderlik sorumluluğu ver', effect: { morale: 4, teamMorale: 2, relationship: 2 } },
        { text: '"Harika gidiyorsun, devam et"', effect: { morale: 3, relationship: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] takım arkadaşlarını coşturuyor: "Arkadaşlar, bu formla namağlup geçebiliriz bu turnuvayı!"',
      options: [
        { text: 'Liderliğini destekle', effect: { morale: 3, teamMorale: 3, relationship: 2 } },
        { text: '"Dikkatli ol, erken konuşma"', effect: { morale: 0, relationship: 0 } },
      ],
    },
    {
      dialogue: '[PLAYER] basına iyi laflar etmiş, seni ve takımı övmüş. Herkes okudu.',
      options: [
        { text: 'Teşekkür et ve ödüllendir', effect: { morale: 4, relationship: 3 } },
        { text: '"Güzel ama odak hep maçta olsun"', effect: { morale: 1, relationship: 0 } },
      ],
    },
    {
      dialogue: '[PLAYER] yeni bir kişisel rekor kırdı ve soyunma odasında kutlamak istiyor.',
      options: [
        { text: 'Takımla birlikte kutla', effect: { morale: 5, teamMorale: 3, relationship: 2 } },
        { text: 'Kısa tut ve devam', effect: { morale: 3, relationship: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sana geliyor: "Hoca, bu formu korumak için ne yapmalıyım? Bir tavsiye var mı?"',
      options: [
        { text: 'Birlikte kişisel plan çiz', effect: { morale: 4, relationship: 3 } },
        { text: '"Dinlenmeye de dikkat et"', effect: { morale: 2, relationship: 1 } },
      ],
    },
  ],
}
