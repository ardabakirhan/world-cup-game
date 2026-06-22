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
      dialogue: '[PLAYER], kollarını kavuşturmuş seni bekliyor: "Hoca, takım kazandı, güzel. Ama ben de oynamak istiyorum. Ne zaman benim sıram?"',
      options: [
        { text: 'Anlayışla karşıla', effect: { morale: 2, relationship: 1 } },
        { text: 'Sert ol', effect: { morale: -3, relationship: -2, discipline: 1 } },
        { text: 'Söz ver', effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] soyunma odasında yaklaşıyor: "Hoca, bugün katkı sunmak isterdim. Neden yedek bıraktınız beni?"',
      options: [
        { text: 'Rotasyon planı açıkla', effect: { morale: 1, relationship: 1 } },
        { text: 'Performansını beğenmediğini söyle', effect: { morale: -4, relationship: -3 } },
        { text: 'Gelecek maçta oynayacaksın de', effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] sessizce yanına geliyor: "Galibiyet güzel ama ben de sahada olmak istiyordum."',
      options: [
        { text: 'Emeğini takdir et', effect: { morale: 2, relationship: 1 } },
        { text: 'Rekabeti kabul et', effect: { morale: -1, relationship: 0 } },
        { text: 'Söz ver', effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] kaptan bandajlı oyuncuya bakarak sana fısıldar: "Hoca, ben de hazırım. Lütfen fırsat verin."',
      options: [
        { text: 'Motivasyonunu güçlendir', effect: { morale: 3, relationship: 2 } },
        { text: 'Sabır iste', effect: { morale: 1, relationship: 0 } },
        { text: 'Bir sonraki maçta başlatacağını söyle', effect: { mustStartNext: true, relationship: 3 } },
      ],
    },
    {
      dialogue: '[PLAYER] yüzü asık odaya giriyor: "Hoca, galibiyet güzel ama yedek koltuğunda oturmak çok zor."',
      options: [
        { text: 'Durumu anladığını belirt', effect: { morale: 2, relationship: 1 } },
        { text: 'Sertçe uyan', effect: { morale: -3, relationship: -2 } },
        { text: 'Birlikte çalışma planı yap', effect: { morale: 3, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] sana bakıyor: "Kazandık, harika. Ama benim için bu galibiyet yarım kaldı."',
      options: [
        { text: 'Empatiyle yaklaş', effect: { morale: 2, relationship: 1 } },
        { text: 'Takım çıkarını öne çıkar', effect: { morale: 0, relationship: 0 } },
        { text: 'Söz ver', effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] antrenmana geç geliyor ve sınıklı görünüyor. Yedek kaldığı için bunalımda.',
      options: [
        { text: 'Özel toplantı yap', effect: { morale: 3, relationship: 2 } },
        { text: 'Görmezden gel', effect: { morale: -2, relationship: -1 } },
        { text: 'Gelecek maç sözü ver', effect: { mustStartNext: true, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] duygusal konuşuyor: "Hoca, bugün tribünden seyrettim. Bu benim için çok ağır."',
      options: [
        { text: 'Sarıl, destek ol', effect: { morale: 4, relationship: 3 } },
        { text: 'Profesyonellik bekle', effect: { morale: -1, relationship: -1 } },
        { text: 'Söz ver', effect: { mustStartNext: true, relationship: 3 } },
      ],
    },
  ],

  benchedAndLost: [
    {
      dialogue: '[PLAYER] soyunma odasında seni köşeye çekiyor: "Hoca, ben sahadaydım belki sonuç farklı olurdu. Bunu düşünmüyor musun?"',
      options: [
        { text: 'Haklısın, bir sonraki maçta oynarsın', effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: 'Kararlarıma güven', effect: { morale: -2, relationship: -1 } },
        { text: 'Performansın yeterli değildi', effect: { morale: -4, relationship: -3, discipline: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] öfkeyle yaklaşıyor: "Bu yenilgi bir mesaj olmalı. Ben hazırım, neden oynamıyorum?"',
      options: [
        { text: 'Sakin ol ve mantıklı konuş', effect: { morale: 1, relationship: 0 } },
        { text: 'Söz ver', effect: { mustStartNext: true, relationship: 2 } },
        { text: 'Tavır beni etkiler de', effect: { morale: -3, relationship: -3, discipline: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] mağlup çıkışını seyredip durumu anlamamış gibi bakıyor: "Hoca, beni oynatsaydınız bu olmazdı."',
      options: [
        { text: 'Kararını açıkla', effect: { morale: 0, relationship: 0 } },
        { text: 'Haklı olabilirsin, söz veriyorum', effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: 'Bu tutum kabul edilemez', effect: { morale: -5, relationship: -4, discipline: 3 } },
      ],
    },
    {
      dialogue: '[PLAYER] başını öne eğerek konuşuyor: "Hoca, kaybettik. Belki beni deneseydiniz daha iyi olurdu."',
      options: [
        { text: 'Gelecek maçta şansını ver', effect: { mustStartNext: true, relationship: 2, morale: 2 } },
        { text: 'Takım kararı olduğunu anlat', effect: { morale: 0, relationship: 0 } },
        { text: 'Daha fazla çalışman gerekiyor', effect: { morale: -2, relationship: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] gözleri dolu söylüyor: "Bu yenilgi... Ben hazırdım hoca. Neden beni görmediniz?"',
      options: [
        { text: 'Duygularını anla ve destek ver', effect: { morale: 3, relationship: 2 } },
        { text: 'Söz ver', effect: { mustStartNext: true, relationship: 3, morale: 2 } },
        { text: 'Daha sakin ol', effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sert bir ses tonuyla: "Hoca, bu kadro seçimi hatalıydı. Ben oynasaydım fark yaratırdım."',
      options: [
        { text: 'Sakin bir şekilde açıkla', effect: { morale: 0, relationship: 0 } },
        { text: 'Bir sonraki maçta kanıtla de', effect: { mustStartNext: true, relationship: 1 } },
        { text: 'Bu tutum ceza gerektirir', effect: { morale: -5, relationship: -5, discipline: 4 } },
      ],
    },
    {
      dialogue: '[PLAYER] kapıda durmuş bekliyor: "Hoca, bir saniyeniz var mı? Yedek kalma konusunu konuşmak istiyorum."',
      options: [
        { text: 'Kapsamlı bir konuşma yap', effect: { morale: 3, relationship: 3 } },
        { text: 'Kısa tut, taktik karar de', effect: { morale: 0, relationship: 0 } },
        { text: 'Şimdi değil de', effect: { morale: -2, relationship: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] sahayı seyrederken dönüp bakıyor: "Kaybettik ve ben hiç katkı sunamadım. Bu benim için çok zor."',
      options: [
        { text: 'Empatiyle destek ver', effect: { morale: 3, relationship: 2 } },
        { text: 'Söz ver', effect: { mustStartNext: true, relationship: 3, morale: 2 } },
        { text: 'Takım işi olduğunu söyle', effect: { morale: 0, relationship: 0 } },
      ],
    },
  ],

  benchedThreeMatches: [
    {
      dialogue: '[PLAYER] artık sabırsız: "Üç maçtır forma giymiyorum. Bana güvenmiyorsanız söyleyin, kulübüme döneyim."',
      options: [
        { text: 'Planında yerin var, sabret', effect: { morale: 1, relationship: 1 } },
        { text: 'Rekabet etmek zorundasın', effect: { morale: -2, relationship: -2 } },
        { text: 'Söz veriyorum, oynayacaksın', effect: { mustStartNext: true, relationship: 3, morale: 3 } },
      ],
    },
    {
      dialogue: '[PLAYER] menajerini arayacağını ima ediyor: "Hoca, üç maçtır yedekte oturuyorum. Bu böyle gidemez."',
      options: [
        { text: 'Durumunu anla ve söz ver', effect: { mustStartNext: true, relationship: 2, morale: 2 } },
        { text: 'Rekabeti kabul etmesini iste', effect: { morale: -1, relationship: -1 } },
        { text: 'Tutumu kabul edilemez de', effect: { morale: -4, relationship: -4, discipline: 3 } },
      ],
    },
    {
      dialogue: '[PLAYER] açık açık söylüyor: "Üç maçtır oynamadım. Ya beni oynatasınız ya da çözüm bulun."',
      options: [
        { text: 'Oynayacağına söz ver', effect: { mustStartNext: true, relationship: 2, morale: 2 } },
        { text: 'Alternatiflerini değerlendireceğini belirt', effect: { morale: -2, relationship: -1 } },
        { text: 'Disiplin altına al', effect: { morale: -5, relationship: -5, discipline: 5 } },
      ],
    },
    {
      dialogue: '[PLAYER] gözlerinde keder: "Hoca, üç maçtır çamura saplanmış gibiyim. Bana bir şans verin."',
      options: [
        { text: 'Duygusal destek ver ve söz ver', effect: { morale: 4, relationship: 3, mustStartNext: true } },
        { text: 'Sabret, sıran gelecek de', effect: { morale: 1, relationship: 0 } },
        { text: 'Performansına bak de', effect: { morale: -2, relationship: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] takım arkadaşlarına yakınmaya başlamış: "Yedekte oturuyorum, saçma bir durum bu."',
      options: [
        { text: 'Özel konuşma yap ve söz ver', effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: 'Uyarı ver', effect: { morale: -3, relationship: -3, discipline: 2 } },
        { text: 'Takım içi şikayetin cezası var de', effect: { morale: -5, relationship: -5, discipline: 4 } },
      ],
    },
    {
      dialogue: '[PLAYER] sana doğrudan bakarak: "Hoca, üç maç oldu. Değerlendirmemi yapmam gerekiyor."',
      options: [
        { text: 'Planını açıkla ve söz ver', effect: { morale: 3, relationship: 2, mustStartNext: true } },
        { text: 'Rekabet ortamı normal de', effect: { morale: 0, relationship: 0 } },
        { text: 'Karara saygı duy de', effect: { morale: -2, relationship: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] antrenmanları eksik katılmaya başladı. Üç maçlık yedeklik onu olumsuz etkiliyor.',
      options: [
        { text: 'Özel toplantı yap ve söz ver', effect: { morale: 4, relationship: 3, mustStartNext: true } },
        { text: 'Sert uyan', effect: { morale: -3, relationship: -3, discipline: 3 } },
        { text: 'Destek ver, sezon uzun de', effect: { morale: 2, relationship: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] kapıdan girerken: "Hoca, konuşabilir miyiz? Üç maçtır oynamıyorum ve anlamıyorum neden."',
      options: [
        { text: 'Detaylı açıklama yap', effect: { morale: 2, relationship: 2 } },
        { text: 'Söz ver ve güven ver', effect: { mustStartNext: true, relationship: 3, morale: 3 } },
        { text: 'Şu an uygun değilim de', effect: { morale: -3, relationship: -2 } },
      ],
    },
  ],

  captainPoorMatch: [
    {
      dialogue: 'Kaptan [PLAYER] soyunma odasında konuşuyor: "Bu performansın sorumluluğunu alıyorum. Takımı ben toparlayacağım."',
      options: [
        { text: 'Sana güveniyorum', effect: { morale: 3, teamMorale: 2 } },
        { text: 'Herkes daha iyi olmalı', effect: { morale: 0, teamMorale: 0 } },
        { text: 'Kaptanlığı gözden geçirebilirim', effect: { morale: -5, relationship: -4 } },
      ],
    },
    {
      dialogue: 'Kaptan [PLAYER] senin önünde duruyor: "Hoca, bugün yeterince liderlik yapamadım. Bunun telafisini yapacağım."',
      options: [
        { text: 'Güven ver', effect: { morale: 3, relationship: 2, teamMorale: 1 } },
        { text: 'Doğru, daha iyi liderlik gerek', effect: { morale: 1, relationship: 0 } },
        { text: 'Kaptanlık konusunu düşüneceğim de', effect: { morale: -3, relationship: -3 } },
      ],
    },
    {
      dialogue: 'Kaptan [PLAYER] takım adına özür diliyor: "Hoca, bu maç bizim hatamız. Bir dahakine farklı olacak."',
      options: [
        { text: 'Liderliğini takdir et', effect: { morale: 4, relationship: 2, teamMorale: 2 } },
        { text: 'Söz gerektiren şeyi gör', effect: { morale: 1, relationship: 0 } },
        { text: 'Söz değil eylem gerek', effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: 'Kaptan [PLAYER] soyunma odasını toparlıyor: "Arkadaşlar, ben bu takımın kaptanıyım ve tek sözüm var: bir dahakine!"',
      options: [
        { text: 'Motivasyonunu destekle', effect: { morale: 4, teamMorale: 3 } },
        { text: 'Sen de katıl ve konuş', effect: { morale: 2, teamMorale: 2 } },
        { text: 'Boş söz de', effect: { morale: -2, relationship: -2 } },
      ],
    },
    {
      dialogue: 'Kaptan [PLAYER] seninle baş başa: "Hoca, takımı düzelteceğim. Ama ben de daha iyi oynadım bugün."',
      options: [
        { text: 'Dürüstlüğünü takdir et', effect: { morale: 2, relationship: 2 } },
        { text: 'Hem sorumluluk hem özeleştiri güzel', effect: { morale: 3, relationship: 2, teamMorale: 1 } },
        { text: 'Performans değil liderlik önemli', effect: { morale: 1, relationship: 0 } },
      ],
    },
    {
      dialogue: 'Kaptan [PLAYER] senin masana kağıt bırakıyor: bir sonraki maç için yazdığı motivasyon notu.',
      options: [
        { text: 'Tüm takımla paylaş', effect: { morale: 4, teamMorale: 3, relationship: 2 } },
        { text: 'Özel tut ve destekle', effect: { morale: 2, relationship: 1 } },
        { text: 'Bunu bırak, odaklan', effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: 'Kaptan [PLAYER] sessizce odandan çıkmak üzere duraksıyor: "Hoca, bu takım benden daha fazlasını hak ediyor."',
      options: [
        { text: 'Takımın şansısın sen de', effect: { morale: 4, teamMorale: 2, relationship: 2 } },
        { text: 'Doğru söylüyorsun, birlikte çalışalım', effect: { morale: 2, relationship: 1 } },
        { text: 'Bu düşünce seni geri çekiyor', effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: 'Kaptan [PLAYER] diğer oyunculara bakıyor: "Hoca, soyunma odası toplantısı yapabilir miyiz? Ben liderlik edeceğim."',
      options: [
        { text: 'Evet, sen yönet', effect: { morale: 3, teamMorale: 3, relationship: 2 } },
        { text: 'Ben yönetirim, sen destek ver', effect: { morale: 1, teamMorale: 2 } },
        { text: 'Gerek yok', effect: { morale: -2, relationship: -1 } },
      ],
    },
  ],

  youngPlayerFirstCap: [
    {
      dialogue: '[PLAYER] gözleri parlayarak yanına geliyor: "Hoca, hayatımın en güzel günüydü. Teşekkür ederim, hayal ettiğim gibiydi!"',
      options: [
        { text: 'Gurur duyuyorum, devam et', effect: { morale: 5, relationship: 3 } },
        { text: 'İyi başlangıç, ama daha çok çalış', effect: { morale: 2, relationship: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sana sarılmak için koşuyor: "Hoca! İlk millî maçım! İnanamıyorum!"',
      options: [
        { text: 'Sarıl ve tebrik et', effect: { morale: 6, relationship: 4, teamMorale: 1 } },
        { text: 'Tebrikler, ama mütevazı kal', effect: { morale: 3, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] çok heyecanlı: "Bugün sahaya çıktığımda ailem tribündeydi. Onlar için her şeyimi verdim."',
      options: [
        { text: 'Aileni aramayı düşün de', effect: { morale: 5, relationship: 3 } },
        { text: 'Her maçta bu ruhu görmek istiyorum', effect: { morale: 4, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] bayağı utangaç: "Hoca... bugün oynamak nasıl bir şeydi bilmiyorum. Rüya gibiydi."',
      options: [
        { text: 'Bu his her maçta kalsın', effect: { morale: 5, relationship: 3 } },
        { text: 'Gelecek sefer daha iyisi için çalış', effect: { morale: 3, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] diğer oyuncularla sarılıp kutlayınca sana bakıyor: "Bu an için saatlerce antrenman yaptım."',
      options: [
        { text: 'Emek karşılığını buldu', effect: { morale: 5, relationship: 3 } },
        { text: 'Devam et, bu sadece başlangıç', effect: { morale: 4, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] duygusal bir mesaj gönderiyor: "Hocam, hayatımın dönüm noktasısınız. Teşekkürler."',
      options: [
        { text: 'Geleceğine inandığını söyle', effect: { morale: 6, relationship: 4 } },
        { text: 'Takım başarısı önemli de', effect: { morale: 3, relationship: 2 } },
      ],
    },
    {
      dialogue: '[PLAYER] sahadan çıkarken ağlıyor: "Özür dilerim hoca. Çok heyecanlandım."',
      options: [
        { text: 'Ağlamak utanılacak bir şey değil de', effect: { morale: 5, relationship: 4 } },
        { text: 'Bu duygu güç kaynağın olsun', effect: { morale: 4, relationship: 3 } },
      ],
    },
    {
      dialogue: '[PLAYER] annesini arayarak ağlıyor: "Anne, oynadım! Milli maç!" Sana dönerek teşekkür ediyor.',
      options: [
        { text: 'Yanında dur', effect: { morale: 6, relationship: 4, teamMorale: 1 } },
        { text: 'Güzel an, devam et', effect: { morale: 4, relationship: 2 } },
      ],
    },
  ],

  threeMatchLosingStreak: [
    {
      dialogue: 'Takım kaptanı [PLAYER] oyuncular adına konuşuyor: "Hoca, bir toplantı yapmalıyız. Takımda bir şeyler yanlış gidiyor."',
      options: [
        { text: 'Haklısın, toplantı yapalım', effect: { morale: 4, teamMorale: 3 } },
        { text: 'Ben hallederim, güvenin bana', effect: { morale: -1, relationship: -1 } },
        { text: 'Daha çok antrenman', effect: { morale: -2, teamMorale: -1 } },
      ],
    },
    {
      dialogue: '[PLAYER] soyunma odasında ayakta: "Üç maçtır kaybediyoruz. Bu takım bu değil. Bir şeyler yapmalıyız."',
      options: [
        { text: 'Liderliğini destekle', effect: { morale: 3, teamMorale: 3, relationship: 1 } },
        { text: 'Planımız var, güvenik', effect: { morale: 1, teamMorale: 1 } },
        { text: 'Sen de analiz yapmalısın de', effect: { morale: -1, relationship: -1 } },
      ],
    },
    {
      dialogue: 'Kaptan [PLAYER] sana geliyor: "Hoca, oyuncular kendinden şüphe duymaya başladı. Nasıl çözebiliriz?"',
      options: [
        { text: 'Birlikte çözüm bul', effect: { morale: 4, teamMorale: 3 } },
        { text: 'Ben planı belirlerim de', effect: { morale: 1, teamMorale: 0 } },
        { text: 'Bu geçici, ilerleriz de', effect: { morale: 0, teamMorale: -1 } },
      ],
    },
    {
      dialogue: '[PLAYER] sessiz soyunma odasına bakıyor: "Hoca, bir motivasyon konuşması yapar mısınız? Takım bunu çok ihtiyaç duyuyor."',
      options: [
        { text: 'Güçlü bir konuşma yap', effect: { teamMorale: 5, morale: 2 } },
        { text: 'Sen yap, sen kaptan diyorsun', effect: { morale: 2, relationship: 2, teamMorale: 2 } },
        { text: 'Kelimeler değil sonuçlar önemli de', effect: { teamMorale: -1, morale: -1 } },
      ],
    },
    {
      dialogue: '[PLAYER] gözleri dolarak: "Hoca, takım olarak bir şeyler kaybediyoruz. Bu ruhu nasıl geri kazanabiliriz?"',
      options: [
        { text: 'Ortak aktivite planla', effect: { teamMorale: 4, morale: 3 } },
        { text: 'Soyunma odası toplantısı yap', effect: { teamMorale: 3, morale: 2 } },
        { text: 'Antrenman artır de', effect: { teamMorale: -1, morale: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] senin masanı çalıyor: "Hoca, oyuncular seni görmek istiyor. Açık kapı toplantısı olabilir mi?"',
      options: [
        { text: 'Şimdi yapabiliriz', effect: { teamMorale: 4, morale: 3, relationship: 2 } },
        { text: 'Yarın organize ederiz', effect: { teamMorale: 1, morale: 1 } },
        { text: 'Gerek yok, odaklanın de', effect: { teamMorale: -2, morale: -2 } },
      ],
    },
    {
      dialogue: '[PLAYER] sessiz takım arkadaşlarını işaret ediyor: "Hoca, moral çok düşük. Birlikte bir şeyler yapalım."',
      options: [
        { text: 'Takım yemeği organize et', effect: { teamMorale: 5, morale: 3 } },
        { text: 'Video analiz toplantısı yap', effect: { teamMorale: 2, morale: 1 } },
        { text: 'Antrenmanla çözülür de', effect: { teamMorale: -1, morale: -1 } },
      ],
    },
    {
      dialogue: '[PLAYER] omuzları düşük: "Üç maçtır kazanamadık. Ben ne yapabilirim sizin için hoca?"',
      options: [
        { text: 'Liderlik etmesini iste', effect: { morale: 4, teamMorale: 3, relationship: 2 } },
        { text: 'İyi oyna, bu yeter de', effect: { morale: 2, teamMorale: 1 } },
        { text: 'Şu an sadece dinle de', effect: { morale: 1, teamMorale: 1 } },
      ],
    },
  ],

  starPlayerGoodForm: [
    {
      dialogue: '[PLAYER] mutlu görünüyor: "Bu formamı korursam hiçbir takım bizi durduramaz. Şampiyonluğa gidiyoruz!"',
      options: [
        { text: 'Bu ruh halini takıma yay', effect: { teamMorale: 3, morale: 1 } },
        { text: 'Mütevazı kal', effect: { morale: -1, relationship: 0 } },
      ],
    },
    {
      dialogue: '[PLAYER] sahadan yüzü gülüyor: "Hoca, harika hissediyorum. Bu formu sürdürmek istiyorum."',
      options: [
        { text: 'Antrenmanı kişiselleştir', effect: { morale: 3, relationship: 2 } },
        { text: 'Devam et, kazanacağız', effect: { morale: 2, teamMorale: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] antrenman sonrası sana bağırıyor: "Hoca! Bugün formumun zirvesindeyim! Fark yaratacağım!"',
      options: [
        { text: 'Enerjiyi takıma yay', effect: { teamMorale: 3, morale: 2 } },
        { text: 'Güzel, seni dinliyorum', effect: { morale: 2, relationship: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] öz güvenli: "Son birkaç maçım çok iyi gitti. Takıma katkımı artırmak istiyorum."',
      options: [
        { text: 'Kaptanlık sorumlulukları ver', effect: { morale: 4, teamMorale: 2, relationship: 2 } },
        { text: 'Devam et, harika gidiyorsun', effect: { morale: 3, relationship: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] takım arkadaşlarına liderlik ediyor: "Arkadaşlar, bu tempoda devam edersek namağlup çıkabiliriz!"',
      options: [
        { text: 'Liderliğini destekle', effect: { morale: 3, teamMorale: 3, relationship: 2 } },
        { text: 'Dikkatli ol de', effect: { morale: 0, relationship: 0 } },
      ],
    },
    {
      dialogue: '[PLAYER] basına iyi açıklamalar yapıyor. Takımı ve seni övüyor.',
      options: [
        { text: 'Teşekkür et ve ödüllendir', effect: { morale: 4, relationship: 3 } },
        { text: 'Güzel ama odak maçta olsun de', effect: { morale: 1, relationship: 0 } },
      ],
    },
    {
      dialogue: '[PLAYER] yeni bir performans rekoru kırdı ve kutlamak istiyor.',
      options: [
        { text: 'Takımla birlikte kutla', effect: { morale: 5, teamMorale: 3, relationship: 2 } },
        { text: 'Kısa bir kutlama yap', effect: { morale: 3, relationship: 1 } },
      ],
    },
    {
      dialogue: '[PLAYER] teknik direktöre yaklaşıyor: "Hoca, bu formu korumak için ne yapmalıyım?"',
      options: [
        { text: 'Kişisel antrenman planı yap', effect: { morale: 4, relationship: 3 } },
        { text: 'Dinlenmeye de önem ver de', effect: { morale: 2, relationship: 1 } },
      ],
    },
  ],
}
