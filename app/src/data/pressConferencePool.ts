/** Pre-written Turkish press conference question pool. */

export type PressCategory = 'afterWin' | 'afterLoss' | 'afterDraw' | 'afterBigWin'

export interface PressChoice {
  text: string
  effect: {
    pressRelation?: number
    teamMorale?: number
    boardConfidence?: number
  }
}

export interface PressQuestion {
  question: string
  /** [BENCHED_STAR] and [DROPPED_PLAYER] replaced at render time. */
  options: PressChoice[]
}

export const PRESS_QUESTIONS: Record<PressCategory, PressQuestion[]> = {
  afterWin: [
    {
      question: 'Harika bir galibiyet! Bu performansın sırrı neydi?',
      options: [
        { text: 'Takımın birliği ve çalışma azmi', effect: { pressRelation: 1 } },
        { text: 'Taktiksel üstünlüğümüz belirleyiciydi', effect: { boardConfidence: 1 } },
        { text: 'Şans da yardımcı oldu tabii', effect: { pressRelation: 2, boardConfidence: -1 } },
      ],
    },
    {
      question: 'Rakip çok güçlüydü. Nasıl üstesinden geldiniz?',
      options: [
        { text: 'Defansif disiplinimiz mükemmeldi', effect: { pressRelation: 1 } },
        { text: 'Oyuncularım her şeyi verdi', effect: { teamMorale: 1 } },
        { text: 'Rakibi küçümsemiyoruz', effect: { pressRelation: 1 } },
      ],
    },
    {
      question: 'Bu galibiyet turnuva hedeflerinizi değiştirir mi?',
      options: [
        { text: 'Maç maç düşünüyoruz', effect: { pressRelation: 1 } },
        { text: 'Şampiyonluğa gidiyoruz elbette!', effect: { boardConfidence: 2, teamMorale: 1 } },
        { text: 'Hedefimiz değişmedi, odaklıyız', effect: { pressRelation: 1, boardConfidence: 1 } },
      ],
    },
    {
      question: '[BENCHED_STAR] sahaya çıkmadı. Bu bilinçli bir karar mıydı?',
      options: [
        { text: 'Taktik bir karardı, her oyuncu önemli', effect: { pressRelation: 1 } },
        { text: 'Rotasyon yaptım, uzun turnuva var', effect: { pressRelation: 2 } },
        { text: 'Formunu değerlendirdim', effect: { pressRelation: 0 } },
      ],
    },
    {
      question: 'Taraftarlar çok coşkuluydu. Bu nasıl bir duygu?',
      options: [
        { text: 'Taraftarlar 12. oyuncumuz, teşekkürler', effect: { pressRelation: 2, teamMorale: 1 } },
        { text: 'Onlar için kazandık', effect: { pressRelation: 1, teamMorale: 1 } },
        { text: 'Destek her zaman güç veriyor', effect: { pressRelation: 1 } },
      ],
    },
    {
      question: 'Özel olarak öne çıkan bir oyuncuyu paylaşır mısınız?',
      options: [
        { text: 'Tüm takım olarak kazandık', effect: { teamMorale: 2, pressRelation: 1 } },
        { text: 'Kalecimiz muhteşemdi', effect: { teamMorale: 1, pressRelation: 1 } },
        { text: 'İsimleri ayırt etmek istemiyorum', effect: { pressRelation: -1 } },
      ],
    },
    {
      question: 'Bir sonraki rakip için hazırlığınız nasıl?',
      options: [
        { text: 'Şimdiden çalışmaya başladık', effect: { boardConfidence: 1 } },
        { text: 'Bugünü kutlayalım, yarın hazırlanırız', effect: { pressRelation: 1 } },
        { text: 'Her rakibe saygıyla yaklaşıyoruz', effect: { pressRelation: 1, boardConfidence: 1 } },
      ],
    },
    {
      question: 'Bu başarı devre arası analizinizle mi ilgili?',
      options: [
        { text: 'Evet, doğru ayarlamalar yaptık', effect: { boardConfidence: 2, pressRelation: 1 } },
        { text: 'Oyuncularımın adaptasyonu harikaydı', effect: { teamMorale: 1, pressRelation: 1 } },
        { text: 'Takım olarak öğreniyoruz', effect: { pressRelation: 1 } },
      ],
    },
  ],

  afterLoss: [
    {
      question: 'Bu yenilgi beklenmedik miydi? Ne yanlış gitti?',
      options: [
        { text: 'Savunmamız iyi değildi, kabul ediyorum', effect: { pressRelation: 1, boardConfidence: -1 } },
        { text: 'Rakip bugün daha iyiydi', effect: { pressRelation: 0 } },
        { text: 'Yorumlamak istemiyorum', effect: { pressRelation: -2 } },
      ],
    },
    {
      question: 'Kadro seçiminiz sorgulanıyor. [BENCHED_STAR] neden oynamadı?',
      options: [
        { text: 'Taktik bir karardı', effect: { pressRelation: 0 } },
        { text: 'Formda değildi', effect: { pressRelation: -1, teamMorale: -1 } },
        { text: 'Rotasyon yaptım, bu maç için doğru değerlendirdim', effect: { pressRelation: 1 } },
      ],
    },
    {
      question: 'Taraftarlar hayal kırıklığı içinde. Onlara ne söylemek istersiniz?',
      options: [
        { text: 'Özür dileriz, bir dahakine daha iyi olacağız', effect: { pressRelation: 2 } },
        { text: 'Onların desteği bize güç veriyor', effect: { pressRelation: 1 } },
        { text: 'Biz de istediğimiz sonucu alamadık', effect: { pressRelation: 0 } },
      ],
    },
    {
      question: 'Rakibin belirleyici anı neydi sizce?',
      options: [
        { text: 'İlk gol morali bozdu', effect: { pressRelation: 1 } },
        { text: 'Biz fırsatları değerlendiremedik', effect: { pressRelation: 2 } },
        { text: 'Rakip bugün her alanda üstündü', effect: { pressRelation: 0 } },
      ],
    },
    {
      question: 'Bu yenilgi sonrası kadro değişikliği olacak mı?',
      options: [
        { text: 'Değerlendirme yapacağız', effect: { pressRelation: 1, boardConfidence: -1 } },
        { text: 'Özünüzü koruyacağız', effect: { pressRelation: 1 } },
        { text: 'Oyuncularımıza güveniyorum', effect: { pressRelation: 0, teamMorale: 1 } },
      ],
    },
    {
      question: 'Bir sonraki maç çok kritik. Nasıl toparlanacaksınız?',
      options: [
        { text: 'Analiz edip daha güçlü döneceğiz', effect: { boardConfidence: 1, pressRelation: 1 } },
        { text: 'Takımım karakterini biliyorum', effect: { teamMorale: 1, pressRelation: 1 } },
        { text: 'Şu an konuşmak zor', effect: { pressRelation: -1 } },
      ],
    },
    {
      question: 'İlk yarı performansınız zayıftı. Neden değiştiremediiniz?',
      options: [
        { text: 'Doğru analiz yapamadık', effect: { pressRelation: 1 } },
        { text: 'Rakip çok iyi çıktı', effect: { pressRelation: 0 } },
        { text: 'Düzeltmeler yaptık ama geç kaldı', effect: { pressRelation: 1 } },
      ],
    },
    {
      question: 'Kendinizi sorguluyor musunuz hoca?',
      options: [
        { text: 'Her yenilginin ardından kendimi sorgularım', effect: { pressRelation: 2 } },
        { text: 'Sürece güveniyorum', effect: { pressRelation: 0, boardConfidence: 1 } },
        { text: 'Tek bir maç bizi yıkmaz', effect: { pressRelation: 0 } },
      ],
    },
  ],

  afterDraw: [
    {
      question: 'Beraberlik yeterliydi sizin için ya da daha fazlasını bekliyor muydunuz?',
      options: [
        { text: 'Daha fazlasını isterdik', effect: { pressRelation: 1 } },
        { text: 'Bu rakibe karşı puan kazanmak önemliydi', effect: { pressRelation: 1, boardConfidence: 1 } },
        { text: 'Mücadele ettik, tatmin edici', effect: { pressRelation: 0 } },
      ],
    },
    {
      question: 'Gol fırsatları harcandı. Hücumda neden etkisiz kaldınız?',
      options: [
        { text: 'Şansımız yaver gitmedi', effect: { pressRelation: 0 } },
        { text: 'Hücum etkinliğimizi artıracağız', effect: { pressRelation: 1, boardConfidence: 1 } },
        { text: 'Rakip de iyi savundu', effect: { pressRelation: 1 } },
      ],
    },
    {
      question: 'Kaleci [BENCHED_STAR] yoktu. Bu sonucu etkiledi mi?',
      options: [
        { text: 'Taktik bir karardı', effect: { pressRelation: 1 } },
        { text: 'Oynayan oyuncular her şeyini verdi', effect: { teamMorale: 1, pressRelation: 0 } },
        { text: 'Bu soruyu pas geçiyorum', effect: { pressRelation: -1 } },
      ],
    },
    {
      question: 'Beraberlik sonrası grupta durumunuz nasıl?',
      options: [
        { text: 'Hâlâ iyi konumdayız', effect: { boardConfidence: 1, pressRelation: 1 } },
        { text: 'Her puan önemli, kazanmaya devam', effect: { pressRelation: 1 } },
        { text: 'Hesaplamalar yapılıyor', effect: { pressRelation: 0 } },
      ],
    },
    {
      question: 'İkinci yarıda oyun daha dinamik oldu. Devre arası ne söylediniz?',
      options: [
        { text: 'Baskı yapmalarını istedim', effect: { boardConfidence: 1 } },
        { text: 'Oyuncularımı motive ettim', effect: { teamMorale: 1, pressRelation: 1 } },
        { text: 'Detayları paylaşmam', effect: { pressRelation: 0 } },
      ],
    },
    {
      question: 'Bu tempoyla devam edilebilir mi?',
      options: [
        { text: 'Evet, inancımı kaybetmiyorum', effect: { boardConfidence: 1, pressRelation: 1 } },
        { text: 'İyileştirme alanlarımız var', effect: { pressRelation: 1 } },
        { text: 'Takım çalışıyor, bu yeterli', effect: { pressRelation: 0 } },
      ],
    },
  ],

  afterBigWin: [
    {
      question: 'Büyük galibiyet! Şampiyonluğu düşünüyor musunuz artık?',
      options: [
        { text: 'Maç maç düşünüyoruz', effect: { pressRelation: 1 } },
        { text: 'Neden düşünmeyelim? Gidiyoruz!', effect: { boardConfidence: 2, pressRelation: 1, teamMorale: 1 } },
        { text: 'Erken konuşmak istemiyorum', effect: { pressRelation: 0 } },
      ],
    },
    {
      question: 'Bu kadar gol atmak nasıl bir duygu?',
      options: [
        { text: 'Hücum etkinliğimiz muhtesemdi', effect: { pressRelation: 1, teamMorale: 1 } },
        { text: 'Oyuncularım bugün rüzgar gibiydi', effect: { teamMorale: 2, pressRelation: 1 } },
        { text: 'Çok istiyorduk ve yaptık', effect: { pressRelation: 1, boardConfidence: 1 } },
      ],
    },
    {
      question: 'Rakip bu kadar gol yedi. Onlara acıdınız mı?',
      options: [
        { text: 'Futbolda bu olabilir', effect: { pressRelation: 1 } },
        { text: 'Saygımı koruyorum, bu futbol', effect: { pressRelation: 2 } },
        { text: 'Biz sadece oynadık', effect: { pressRelation: 0 } },
      ],
    },
    {
      question: 'Bu galibiyet takımın özgüvenine ne katacak?',
      options: [
        { text: 'Her şeyi katacak, biz güçlüyüz', effect: { teamMorale: 2, boardConfidence: 2, pressRelation: 1 } },
        { text: 'Motivasyon artı ama dikkatli olacağız', effect: { pressRelation: 1, teamMorale: 1 } },
        { text: 'Bir galibiyetle her şey değişmez', effect: { pressRelation: 1 } },
      ],
    },
    {
      question: 'Hangi oyununuzu bu kadar güçlü yapıyor?',
      options: [
        { text: 'Birlik, baskı ve hız', effect: { pressRelation: 1, boardConfidence: 1 } },
        { text: 'Takım kimyamız harika', effect: { teamMorale: 1, pressRelation: 1 } },
        { text: 'Her departman bugün mükemmeldi', effect: { pressRelation: 2 } },
      ],
    },
    {
      question: 'Dünya bu maçı konuşuyor. Bunu nasıl yorumluyorsunuz?',
      options: [
        { text: 'Gurur verici, layık olduğumuzu gösterdik', effect: { teamMorale: 2, boardConfidence: 1 } },
        { text: 'Odak gelecek maçta olmalı', effect: { pressRelation: 1 } },
        { text: 'Bu sadece bir adım, devam edeceğiz', effect: { pressRelation: 1, boardConfidence: 1 } },
      ],
    },
    {
      question: 'Tarihî bir galibiyet mi bu?',
      options: [
        { text: 'Tarih yazıyoruz, evet!', effect: { teamMorale: 2, pressRelation: 1, boardConfidence: 2 } },
        { text: 'Güzel bir an ama kazanmaya devam', effect: { pressRelation: 1 } },
        { text: 'Bu takım çok şey başarabilir', effect: { pressRelation: 1, teamMorale: 1 } },
      ],
    },
  ],
}

