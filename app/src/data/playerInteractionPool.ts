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
        { text: 'Anlayışla karşıla', effect: { morale: 2, relationship: 1 } },
        { text: 'Sert ol', effect: { morale: -3, relationship: -2, discipline: 1 } },
        { text: 'Söz ver: bir sonraki maçta başlıyorsun', effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] soyunma odasından çıkarken duraksıyor: "Hoca, ben hazırım. Sadece bir şans istiyorum."',
      options: [
        { text: 'Planını açıkla', effect: { morale: 1, relationship: 1 } },
        { text: 'Performansın yeterli değil de', effect: { morale: -4, relationship: -3 } },
        { text: 'Gelecek maçta oynarsın', effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] gülümsemeye çalışıyor ama gözleri konuşuyor: "Güzel galibiyet... Ben de sahadaydım keşke."',
      options: [
        { text: 'Takım başarısı önemli de', effect: { morale: 1, relationship: 0 } },
        { text: 'Anlıyorum, sıran gelecek', effect: { morale: 2, relationship: 1 } },
        { text: 'Söz veriyorum', effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: '"[PLAYER] bir şey sormak istiyorum hoca" diye yaklaşıyor. "Neden beni oynatmıyorsunuz?"',
      options: [
        { text: 'Sakin bir şekilde açıkla', effect: { morale: 2, relationship: 1 } },
        { text: 'Antrenmanına bak de', effect: { morale: -2, relationship: -1 } },
        { text: 'Bir sonraki maçta başlatacağım', effect: { mustStartNext: true, relationship: 3 } },
      ],
    },
    {
      dialogue: '[PLAYER] duştan çıkarken: "Hoca, tribünden izlemek çok zor ya. Gerçekten oynamak istiyorum."',
      options: [
        { text: 'Sabret, zamanın gelecek', effect: { morale: 2, relationship: 1 } },
        { text: 'Herkes bekliyor, sen de bekleyeceksin', effect: { morale: -2, relationship: -2 } },
        { text: 'Söz ver', effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] antrenman çantasını bırakırken mırıldanıyor: "Kazanıyoruz ama... ben ne işe yarıyorum ki?"',
      options: [
        { text: 'Değerini anlat', effect: { morale: 3, relationship: 2 } },
        { text: 'Rekabet var, kabul et', effect: { morale: 0, relationship: 0 } },
        { text: 'Söz ver', effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] sana doğrudan bakıyor: "Hoca, açık soruyorum: bana güveniyor musunuz?"',
      options: [
        { text: 'Evet, planında varsın de', effect: { morale: 4, relationship: 2 } },
        { text: 'Güven kazanılır de', effect: { morale: -1, relationship: -1 } },
        { text: 'Söz ver', effect: { mustStartNext: true, relationship: 3 } },
      ],
    },
    {
      dialogue: '[PLAYER] takım kutlamasına katılmıyor, kenarda oturuyor. Yanına gittiğinde: "Özür dilerim hoca, moralim biraz düşük."',
      options: [
        { text: 'Omzuna vur, destekle', effect: { morale: 4, relationship: 3 } },
        { text: 'Takımla kutla, bu davranış doğru değil', effect: { morale: -1, relationship: -1 } },
        { text: 'Söz ver: bir dahakine sahadasın', effect: { mustStartNext: true, relationship: 3 } },
      ],
    },
  ],

  benchedAndLost: [
    {
      dialogue: '[PLAYER] soyunma odasında seni köşeye çekiyor: "Hoca... ben sahadaysaydım belki fark yaratabilirim. Bunu düşündünüz mü?"',
      options: [
        { text: 'Haklısın, bir sonraki maçta başlıyorsun', effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: 'Kararlarıma güven', effect: { morale: -2, relationship: -1 } },
        { text: 'Bu tutum yanlış, kapat şunu', effect: { morale: -5, relationship: -3, discipline: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] öfkeli ama kontrollü: "Hoca, kaybettik. Ve ben hiç oynamadım. Bu mantıklı mı?"',
      options: [
        { text: 'Sakin ol, açıklayayım', effect: { morale: 1, relationship: 0 } },
        { text: 'Bir sonraki maçta kanıtla de', effect: { mustStartNext: true, relationship: 1 } },
        { text: 'Bu tutum beni etkiler', effect: { morale: -4, relationship: -4, discipline: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] gözleri dolu: "Hoca, üzüldüm. Hem kaybettik hem de hiç katkı sunamadım."',
      options: [
        { text: 'Empatiyle yaklaş', effect: { morale: 3, relationship: 2 } },
        { text: 'Söz ver', effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: 'Takım işi, sen de katıldın de', effect: { morale: 0, relationship: 0 } },
      ],
    },
    {
      dialogue: '"[PLAYER] hoca, bir konuşabilir miyiz?" diye soruyor. "Neden ben oynamıyorum, üstelik de kaybettik."',
      options: [
        { text: 'Kapsamlı konuş', effect: { morale: 3, relationship: 3 } },
        { text: 'Kısa tut, taktik karar de', effect: { morale: 0, relationship: 0 } },
        { text: 'Şu an uygun değil', effect: { morale: -3, relationship: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] locker başında oturup dinlemiyor kimseyi: "Bu yenilgi gereksizdi. Ben oynasaydım..."',
      options: [
        { text: 'Kapat şunu, takım oluyoruz de', effect: { morale: -2, discipline: 2, relationship: -2 } },
        { text: 'Gelecek maçta oynayacaksın', effect: { mustStartNext: true, relationship: 2, morale: 2 } },
        { text: 'Konuşalım baş başa', effect: { morale: 2, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] soyunma odasını terk ederken: "Hoca, bir dahakine beni oynatsanız iyi olur."',
      options: [
        { text: 'Söz veriyorum', effect: { mustStartNext: true, relationship: 2, morale: 2 } },
        { text: 'Rekabet normal, sıran gelecek', effect: { morale: 0, relationship: 0 } },
        { text: 'Bu şekilde talep edilmez', effect: { morale: -3, relationship: -3, discipline: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] sakin ama kararlı: "Hoca, yedekte otururken kaybetmek ikiye katlanıyor. Bir şans bekliyorum."',
      options: [
        { text: 'Anlıyorum, bir sonraki maç senin', effect: { morale: 4, relationship: 3, mustStartNext: true } },
        { text: 'Sabırlı ol', effect: { morale: 1, relationship: 0 } },
        { text: 'Antrenmanınla kazan şansını', effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sessizce gelip oturuyor yanına: "Hoca... bu böyle olmak zorunda mıydı?"',
      options: [
        { text: 'Açıkla ve söz ver', effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: 'Evet, böyle olması gerekiyordu de', effect: { morale: -1, relationship: -1 } },
        { text: 'Biraz dinlen, konuşuruz de', effect: { morale: 1, relationship: 1 } },
      ],
    },
  ],

  benchedThreeMatches: [
    {
      dialogue: '[PLAYER] artık sabredemez: "Hoca, üç maçtır oturmaktan bıktım. Bana güvenmiyorsanız söyleyin, kulübüme döneceğim."',
      options: [
        { text: 'Planında yerin var, sabret', effect: { morale: 1, relationship: 1 } },
        { text: 'Rekabet etmek zorundasın', effect: { morale: -2, relationship: -2 } },
        { text: 'Söz veriyorum, gelecek maçta oynarsın', effect: { mustStartNext: true, relationship: 3, morale: 3 } },
      ],
    },
    {
      dialogue: '[PLAYER] menajerine mesaj attığını ima ediyor: "Üç maçtır yedekteyim. Bir çözüm gerekiyor."',
      options: [
        { text: 'Planını açıkla ve söz ver', effect: { mustStartNext: true, relationship: 2, morale: 2 } },
        { text: 'Takım kararlarına saygı göster de', effect: { morale: -1, relationship: -1 } },
        { text: 'Bu tutum seni daha kötü konuma düşürür de', effect: { morale: -4, relationship: -4, discipline: 3 } },
      ],
    },
    {
      dialogue: '[PLAYER] direk söylüyor: "Hoca, üç maçtır oturmak yeter. Ya beni oynatsanız ya da açıkça konuşalım."',
      options: [
        { text: 'Bir dahakinde başlıyorsun, söz', effect: { mustStartNext: true, relationship: 2, morale: 2 } },
        { text: 'Kararlarım değişmez de', effect: { morale: -3, relationship: -2 } },
        { text: 'Bu davranış cezası gerektirir', effect: { morale: -5, relationship: -5, discipline: 4 } },
      ],
    },
    {
      dialogue: '[PLAYER] gözlerinde keder var: "Hoca, üç maçtır tribünden seyrediyorum. Bir fırsat verin, hayal kırıklığı yaratmam."',
      options: [
        { text: 'Destek ver ve söz ver', effect: { morale: 4, relationship: 3, mustStartNext: true } },
        { text: 'Sıran gelecek de', effect: { morale: 1, relationship: 0 } },
        { text: 'Performansına bak önce de', effect: { morale: -2, relationship: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] takım arkadaşlarına yakınmaya başlamış, kulak verilmiş: "Anlamlı bir açıklama bile yok."',
      options: [
        { text: 'Özel konuşma yap ve söz ver', effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: 'Şikayeti soyunma odasına taşıma de', effect: { morale: -3, relationship: -3, discipline: 2 } },
        { text: 'Ceza yazacağım bir dahakine', effect: { morale: -5, relationship: -5, discipline: 5 } },
      ],
    },
    {
      dialogue: '[PLAYER] sana bakarak: "Hoca, dürüst ol benimle. Planımda gerçekten var mıyım?"',
      options: [
        { text: 'Evet, planında varsın. Ve gelecek maç senidir', effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: 'Takım rekabeti var de', effect: { morale: 0, relationship: 0 } },
        { text: 'Bunu sormak zorunda değilsin de', effect: { morale: -2, relationship: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] antrenmanlara isteksiz geliyor. Durumu halletmek gerekiyor.',
      options: [
        { text: 'Baş başa otur ve çöz', effect: { morale: 4, relationship: 3, mustStartNext: true } },
        { text: 'Disiplin kurallarını hatırlat', effect: { morale: -3, relationship: -3, discipline: 3 } },
        { text: 'Sezon uzun, sıranı bekle de', effect: { morale: 2, relationship: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sana gelip oturuyor: "Hoca, neden oynatmıyorsunuz? Gerçekten anlamak istiyorum."',
      options: [
        { text: 'Detaylı açıklama yap', effect: { morale: 2, relationship: 2 } },
        { text: 'Söz ver ve güven ver', effect: { mustStartNext: true, relationship: 3, morale: 3 } },
        { text: 'Şu an zamanı değil de', effect: { morale: -3, relationship: -2 } },
      ],
    },
  ],

  captainPoorMatch: [
    {
      dialogue: 'Kaptan [PLAYER] soyunma odasında ayağa kalkıyor: "Arkadaşlar, bu benim hatam. Ben toparlayacağım bu takımı."',
      options: [
        { text: 'Güveniyorum sana', effect: { morale: 3, teamMorale: 2 } },
        { text: 'Hep beraber toparlayacağız de', effect: { morale: 1, teamMorale: 1 } },
        { text: 'Kaptanlığı düşüneceğim de', effect: { morale: -5, relationship: -4 } },
      ],
    },
    {
      dialogue: '[PLAYER] sana geliyor: "Hoca, bugün liderlik yapamadım. Bir dahakine farklı olacak, söz."',
      options: [
        { text: 'Güven ver', effect: { morale: 3, relationship: 2, teamMorale: 1 } },
        { text: 'Doğru, daha güçlü liderlik gerek', effect: { morale: 1, relationship: 0 } },
        { text: 'Kaptanlığı gözden geçiririm de', effect: { morale: -3, relationship: -3 } },
      ],
    },
    {
      dialogue: 'Kaptan [PLAYER] takım adına konuşuyor: "Hoca, özür dileriz. Bu bizim hatamız."',
      options: [
        { text: 'Liderliğini takdir et', effect: { morale: 4, relationship: 2, teamMorale: 2 } },
        { text: 'Söz yetmez, eylem gerek de', effect: { morale: 1, relationship: 0 } },
        { text: 'Hataları analiz edelim beraber', effect: { morale: 2, teamMorale: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] soyunma odasını sessizlikten kurtarıyor: "Arkadaşlar! Bir maç kaybettik. Hepsi bu. Kalkacağız."',
      options: [
        { text: 'Liderliğini destekle', effect: { morale: 4, teamMorale: 3 } },
        { text: 'Sen yönet, ben destekleyeceğim', effect: { morale: 2, teamMorale: 2 } },
        { text: 'Boş söz, eylem göster de', effect: { morale: -2, relationship: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] seninle baş başa: "Hoca, hem takımı toparlayacağım hem de kendim daha iyi oynayacağım. İkisini de yapabilirim."',
      options: [
        { text: 'Dürüstlüğüne saygı duyuyorum de', effect: { morale: 2, relationship: 2 } },
        { text: 'Takıma odaklan şimdi', effect: { morale: 1, teamMorale: 1 } },
        { text: 'İkisini birden yapamayabilirsin de', effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: 'Kaptan [PLAYER] antrenmana erken geliyor ve herkes için plan hazırlıyor. Liderliği seni etkiliyor.',
      options: [
        { text: 'Alenen takdirle', effect: { morale: 4, teamMorale: 3, relationship: 2 } },
        { text: 'Özel olarak teşekkür et', effect: { morale: 2, relationship: 1 } },
        { text: 'Normalin üstünde gerekmiyor de', effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: '[PLAYER] yavaşça: "Hoca, bu takım benden daha iyisini hak ediyor. Ben de daha iyisini yapabilirim."',
      options: [
        { text: 'Bu öz eleştiri güçlü bir işaret de', effect: { morale: 4, teamMorale: 2, relationship: 2 } },
        { text: 'Doğru, birlikte çalışalım', effect: { morale: 2, relationship: 1 } },
        { text: 'Bu düşünce seni zayıflatır de', effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: 'Kaptan [PLAYER]: "Hoca, soyunma odası toplantısı yapabilir miyiz? Ben yönetirim."',
      options: [
        { text: 'Evet, sen yönet', effect: { morale: 3, teamMorale: 3, relationship: 2 } },
        { text: 'Ben yönetirim, sen destek ver', effect: { morale: 1, teamMorale: 2 } },
        { text: 'Gerek yok de', effect: { morale: -2, relationship: -1 } },
      ],
    },
  ],

  youngPlayerFirstCap: [
    {
      dialogue: '[PLAYER] gözleri parlak koşuyor yanına: "Hoca! İlk maçım! İnanamıyorum buna!"',
      options: [
        { text: 'Gurur duyuyorum, devam et böyle', effect: { morale: 5, relationship: 3 } },
        { text: 'Güzel ama bu sadece başlangıç', effect: { morale: 2, relationship: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sana sarılmak için koşuyor: "Hoca, teşekkürler! Bu... bu her şeydi benim için!"',
      options: [
        { text: 'Sarıl ve tebrik et', effect: { morale: 6, relationship: 4, teamMorale: 1 } },
        { text: 'Tebrikler, ama mütevazı kal', effect: { morale: 3, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] heyecandan elleri titriyor: "Ailem tribündeydi hoca. Onlar için her şeyimi verdim."',
      options: [
        { text: 'Ailenle gurur duy de', effect: { morale: 5, relationship: 3 } },
        { text: 'Her maçta bu ruhu istiyorum', effect: { morale: 4, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] biraz utangaç: "Hoca... çok heyecanlandım. Umarım hayal kırıklığı yaratmamışımdır."',
      options: [
        { text: 'Harikaydin, gurur duydum', effect: { morale: 6, relationship: 3 } },
        { text: 'İyi başlangıç, daha iyisini yapacaksın', effect: { morale: 3, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] diğer oyunculara sarılıp kutlarken sana dönüyor: "Hoca, bu an için saatlerce çalıştım."',
      options: [
        { text: 'Emek karşılık buldu', effect: { morale: 5, relationship: 3 } },
        { text: 'Devam et, bu sadece başlangıç', effect: { morale: 4, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] telefona bakıyor: "Annem mesaj atmış hoca: Seni gördüm, ağladım. Teşekkürler."',
      options: [
        { text: 'Geleceğine inandığını söyle', effect: { morale: 6, relationship: 4 } },
        { text: 'Takım için oyna, o zaman anneni mutlu edersin de', effect: { morale: 3, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] sahadan çıkarken gözleri doluyor: "Özür dilerim hoca. Çok duygusalım şu an."',
      options: [
        { text: 'Ağlamak utanılacak şey değil de', effect: { morale: 5, relationship: 4 } },
        { text: 'Bu his güç kaynağın olsun', effect: { morale: 4, relationship: 3 } },
      ],
    },
    {
      dialogue: '[PLAYER] annesini arıyor duyuyorsun: "Anne! Oynadım! Milli maç!" Sonra utanarak sana bakıyor.',
      options: [
        { text: 'Gül ve yanında dur', effect: { morale: 6, relationship: 4, teamMorale: 1 } },
        { text: 'Güzel, o enerjiyi sahaya taşı de', effect: { morale: 4, relationship: 2 } },
      ],
    },
  ],

  threeMatchLosingStreak: [
    {
      dialogue: 'Kaptan [PLAYER] oyuncular adına sana geliyor: "Hoca, bir toplantı yapmalıyız. Bir şeyler yanlış gidiyor."',
      options: [
        { text: 'Haklısın, hemen yapalım', effect: { morale: 4, teamMorale: 3 } },
        { text: 'Ben hallederim, güvenin bana', effect: { morale: -1, relationship: -1 } },
        { text: 'Daha çok antrenman yapacağız', effect: { teamMorale: -1, morale: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] soyunma odasında ayağa kalkıyor: "Üç maçtır kaybediyoruz arkadaşlar. Bu bizim bu değil."',
      options: [
        { text: 'Liderliğini destekle', effect: { morale: 3, teamMorale: 3, relationship: 1 } },
        { text: 'Doğru, plan değiştireceğiz', effect: { morale: 1, teamMorale: 1 } },
        { text: 'Sen de analiz yap de', effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sana geliyor: "Hoca, takımda bir özgüven sorunu var. Ne yapabiliriz?"',
      options: [
        { text: 'Birlikte çözüm üret', effect: { morale: 4, teamMorale: 3 } },
        { text: 'Ben planı belirlerim de', effect: { morale: 1, teamMorale: 0 } },
        { text: 'Bu geçer, sürece güven de', effect: { morale: 0, teamMorale: -1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sessiz soyunma odasını işaret ediyor: "Hoca, bir konuşma yapar mısınız? Takımın buna ihtiyacı var."',
      options: [
        { text: 'Güçlü bir konuşma yap', effect: { teamMorale: 5, morale: 2 } },
        { text: 'Sen yap, sen kaptan değil mi', effect: { morale: 2, relationship: 2, teamMorale: 2 } },
        { text: 'Kelimeler değil sonuçlar önemli de', effect: { teamMorale: -1, morale: -1 } },
      ],
    },
    {
      dialogue: '[PLAYER] soluk soluğa: "Hoca, takım olarak bir şeyleri kaybettik. Nasıl geri alabiliriz bunu?"',
      options: [
        { text: 'Takım aktivitesi planla', effect: { teamMorale: 4, morale: 3 } },
        { text: 'Soyunma odası toplantısı yap', effect: { teamMorale: 3, morale: 2 } },
        { text: 'Daha çok çalışarak', effect: { teamMorale: -1, morale: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] odana vuruyor: "Hoca, oyuncular seninle konuşmak istiyor. Açık kapı toplantısı olabilir mi?"',
      options: [
        { text: 'Şimdi yapalım', effect: { teamMorale: 4, morale: 3, relationship: 2 } },
        { text: 'Yarın organize ederiz', effect: { teamMorale: 1, morale: 1 } },
        { text: 'Gerek yok, odaklanın', effect: { teamMorale: -2, morale: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] sessiz takım arkadaşlarını gösteriyor: "Hoca, herkes bezgin. Bir şeyler yapalım."',
      options: [
        { text: 'Takım yemeği organize et', effect: { teamMorale: 5, morale: 3 } },
        { text: 'Video analiz toplantısı yap', effect: { teamMorale: 2, morale: 1 } },
        { text: 'Antrenmanla çözülür', effect: { teamMorale: -1, morale: -1 } },
      ],
    },
    {
      dialogue: '[PLAYER] omuzları düşük: "Hoca, ben ne yapabilirim sizin için? Söyleyin, yaparım."',
      options: [
        { text: 'Liderlik et de', effect: { morale: 4, teamMorale: 3, relationship: 2 } },
        { text: 'İyi oyna, hepsi bu', effect: { morale: 2, teamMorale: 1 } },
        { text: 'Dinle şimdilik de', effect: { morale: 1, teamMorale: 1 } },
      ],
    },
  ],

  starPlayerGoodForm: [
    {
      dialogue: '[PLAYER] antrenmandan çıkarken rahat rahat: "Hoca, şu an çok iyi hissediyorum. Kimse durduramaz bizi."',
      options: [
        { text: 'Bu enerjiyi takıma ver', effect: { teamMorale: 3, morale: 1 } },
        { text: 'Güzel ama mütevazı kal', effect: { morale: -1, relationship: 0 } },
      ],
    },
    {
      dialogue: '[PLAYER] gülerek: "Hoca, formum çok iyi. Bu tempoyu korursam şampiyonluğa gidiyoruz."',
      options: [
        { text: 'Bunu takıma söyle', effect: { morale: 3, teamMorale: 2 } },
        { text: 'Devam et, kazanacağız', effect: { morale: 2, teamMorale: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] bağırarak: "Hoca! Bu hafta müthiş hissediyorum! Vay be!"',
      options: [
        { text: 'Enerjiyi takıma yay', effect: { teamMorale: 3, morale: 2 } },
        { text: 'Güzel, o enerji sahada kalsın', effect: { morale: 2, relationship: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sakin ama özgüvenli: "Hoca, son birkaç maçım çok iyiydi. Daha fazlasını yapabilirim."',
      options: [
        { text: 'Liderlik sorumluluğu ver', effect: { morale: 4, teamMorale: 2, relationship: 2 } },
        { text: 'Harika gidiyorsun, devam', effect: { morale: 3, relationship: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] takım arkadaşlarını coşturuyor: "Arkadaşlar, bu formla namağlup geçebiliriz bu turnuvayı!"',
      options: [
        { text: 'Liderliğini destekle', effect: { morale: 3, teamMorale: 3, relationship: 2 } },
        { text: 'Dikkatli ol, bu erken de', effect: { morale: 0, relationship: 0 } },
      ],
    },
    {
      dialogue: '[PLAYER] basına iyi laflar etmiş, seni ve takımı övmüş.',
      options: [
        { text: 'Teşekkür et ve ödüllendir', effect: { morale: 4, relationship: 3 } },
        { text: 'Güzel ama odak maçta olsun de', effect: { morale: 1, relationship: 0 } },
      ],
    },
    {
      dialogue: '[PLAYER] yeni bir kişisel rekor kırdı ve kutlamak istiyor.',
      options: [
        { text: 'Takımla kutla', effect: { morale: 5, teamMorale: 3, relationship: 2 } },
        { text: 'Kısa bir kutlama yap', effect: { morale: 3, relationship: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sana geliyor: "Hoca, bu formu korumak için ne yapmalıyım? Tavsiye var mı?"',
      options: [
        { text: 'Kişisel plan çiz beraber', effect: { morale: 4, relationship: 3 } },
        { text: 'Dinlenmeye de dikkat et de', effect: { morale: 2, relationship: 1 } },
      ],
    },
  ],
}
