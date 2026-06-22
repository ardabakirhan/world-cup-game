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
      question: 'Güzel galibiyet. Bu performansın sırrı ne?',
      options: [
        { text: '"Sırrı yok, çok çalıştık."', effect: { pressRelation: 1 } },
        { text: '"Taktiksel olarak rakibi okuduk."', effect: { boardConfidence: 1 } },
        { text: '"Bugün biraz şans da vardı tabii."', effect: { pressRelation: 2, boardConfidence: -1 } },
      ],
    },
    {
      question: 'Rakip güçlüydü. Nasıl üstün geldiniz?',
      options: [
        { text: '"Defansif bloğumuz muhtesemdi."', effect: { pressRelation: 1 } },
        { text: '"Oyuncularım canlarını dişlerine taktı."', effect: { teamMorale: 1 } },
        { text: '"Rakibi küçümsemiyoruz, ama biz daha hazırlıklıydık."', effect: { pressRelation: 1 } },
      ],
    },
    {
      question: 'Bu galibiyet hedeflerinizi değiştiriyor mu?',
      options: [
        { text: '"Maç maç bakıyoruz, daha erken."', effect: { pressRelation: 1 } },
        { text: '"Neden değiştirsin? Şampiyonluğa gidiyoruz."', effect: { boardConfidence: 2, teamMorale: 1 } },
        { text: '"Odaklanmaya devam ediyoruz."', effect: { pressRelation: 1, boardConfidence: 1 } },
      ],
    },
    {
      question: '[BENCHED_STAR] sahaydaydı bugün yok. Neden?',
      options: [
        { text: '"Taktik bir tercihtir, her oyuncuyu kullanırız."', effect: { pressRelation: 1 } },
        { text: '"Rotasyon yaptım, turnuva uzun."', effect: { pressRelation: 2 } },
        { text: '"Bu konuyu soyunma odasında konuşuruz."', effect: { pressRelation: 0 } },
      ],
    },
    {
      question: 'Taraftarlar harika bir atmosfer yarattı. Ne hissettiniz?',
      options: [
        { text: '"12. oyuncumuz onlar, çok teşekkürler."', effect: { pressRelation: 2, teamMorale: 1 } },
        { text: '"Onlar için oynadık bugün."', effect: { pressRelation: 1, teamMorale: 1 } },
        { text: '"Her zaman güç veriyorlar bize."', effect: { pressRelation: 1 } },
      ],
    },
    {
      question: 'Maçta öne çıkan oyuncu kimdi?',
      options: [
        { text: '"Hepsinden söz etmek isterim. Takım olarak kazandık."', effect: { teamMorale: 2, pressRelation: 1 } },
        { text: '"Kalecimiz bugün müthişti."', effect: { teamMorale: 1, pressRelation: 1 } },
        { text: '"Birini öne çıkarmak istemiyorum."', effect: { pressRelation: -1 } },
      ],
    },
    {
      question: 'Önümüzdeki rakip için hazırlık nasıl?',
      options: [
        { text: '"Şimdiden başladık analiz etmeye."', effect: { boardConfidence: 1 } },
        { text: '"Bu geceyi kutlayalım, yarın işe koyuluruz."', effect: { pressRelation: 1 } },
        { text: '"Her rakibe saygıyla yaklaşıyoruz."', effect: { pressRelation: 1, boardConfidence: 1 } },
      ],
    },
    {
      question: 'Devre arasında ne söylediniz oyunculara?',
      options: [
        { text: '"Doğru ayarlamaları yaptık ve işe yaradı."', effect: { boardConfidence: 2, pressRelation: 1 } },
        { text: '"Oyuncularıma güveniyorum, onlar buldu çözümü."', effect: { teamMorale: 1, pressRelation: 1 } },
        { text: '"Soyunma odası sırrı kalır."', effect: { pressRelation: 1 } },
      ],
    },
  ],

  afterLoss: [
    {
      question: '3-0\'dı. Ne yanlış gitti bugün?',
      options: [
        { text: '"Savunmamız çöktü, kabul ediyorum."', effect: { pressRelation: 1, boardConfidence: -1 } },
        { text: '"Rakip bugün her şeyi doğru yaptı."', effect: { pressRelation: 0 } },
        { text: '"Şu an analiz etmek erken."', effect: { pressRelation: -2 } },
      ],
    },
    {
      question: '[BENCHED_STAR] oynamadı. Bu yenilgiyle bağlantılı mı?',
      options: [
        { text: '"Tamamen taktik bir karardı."', effect: { pressRelation: 0 } },
        { text: '"O oynayanlar elimden geleni yaptı."', effect: { teamMorale: 1, pressRelation: -1 } },
        { text: '"Bu soruyu geçiyorum."', effect: { pressRelation: -1 } },
      ],
    },
    {
      question: 'Taraftarlar hayal kırıklığı içinde ayrıldı. Onlara ne söylemek istersiniz?',
      options: [
        { text: '"Özür dileriz. Bir dahakine farklı olacak."', effect: { pressRelation: 2 } },
        { text: '"Destekleri her zaman güç veriyor."', effect: { pressRelation: 1 } },
        { text: '"Biz de istedik ama olmadı."', effect: { pressRelation: 0 } },
      ],
    },
    {
      question: 'Rakibin golü hangi anda oyunu kırdı?',
      options: [
        { text: '"İlk gol sonrası moralimiz bozuldu."', effect: { pressRelation: 1 } },
        { text: '"Biz fırsatları değerlendiremedik, asıl sorun bu."', effect: { pressRelation: 2 } },
        { text: '"Rakip her alanda üstündü bugün."', effect: { pressRelation: 0 } },
      ],
    },
    {
      question: 'Kadro değişikliği olacak mı bir sonraki maçta?',
      options: [
        { text: '"Değerlendirme yapacağız."', effect: { pressRelation: 1, boardConfidence: -1 } },
        { text: '"Oyuncularımıza güveniyorum."', effect: { pressRelation: 0, teamMorale: 1 } },
        { text: '"Her zaman en iyi 11\'i seçerim."', effect: { pressRelation: 1 } },
      ],
    },
    {
      question: 'Nasıl toparlanacaksınız?',
      options: [
        { text: '"Analiz edip daha güçlü geleceğiz."', effect: { boardConfidence: 1, pressRelation: 1 } },
        { text: '"Takımımın karakterine güveniyorum."', effect: { teamMorale: 1, pressRelation: 1 } },
        { text: '"Şu an bunu konuşmak zor."', effect: { pressRelation: -1 } },
      ],
    },
    {
      question: 'İlk yarı çok kötüydü. Devre arası ne söylediniz?',
      options: [
        { text: '"Doğru analiz yapamadık, kabul."', effect: { pressRelation: 1 } },
        { text: '"Rakip çok iyi çıktı, şans da onlardaydı."', effect: { pressRelation: 0 } },
        { text: '"Düzelttik ama geç kaldık maalesef."', effect: { pressRelation: 1 } },
      ],
    },
    {
      question: 'Kendinizi sorguluyor musunuz hoca?',
      options: [
        { text: '"Her yenilginin ardından sorgulanmak gerekir."', effect: { pressRelation: 2 } },
        { text: '"Sürece güveniyorum."', effect: { pressRelation: 0, boardConfidence: 1 } },
        { text: '"Tek bir maç her şeyi değiştirmez."', effect: { pressRelation: 0 } },
      ],
    },
  ],

  afterDraw: [
    {
      question: 'Beraberlik yeterliydi sizin için?',
      options: [
        { text: '"Dürüst olacağım: kazanmak isterdik."', effect: { pressRelation: 1 } },
        { text: '"Bu rakibe karşı puan almak önemliydi."', effect: { pressRelation: 1, boardConfidence: 1 } },
        { text: '"Verdiğimizi aldık bugün."', effect: { pressRelation: 0 } },
      ],
    },
    {
      question: 'Gol fırsatları harcandı. Niçin?',
      options: [
        { text: '"Şans bugün yüzümüze gülmedi."', effect: { pressRelation: 0 } },
        { text: '"Hücum etkinliğimizi artıracağız."', effect: { pressRelation: 1, boardConfidence: 1 } },
        { text: '"Rakip kalecisi iyi oynadı."', effect: { pressRelation: 1 } },
      ],
    },
    {
      question: '[BENCHED_STAR] yoktu. Sonucu etkiliyor muydu?',
      options: [
        { text: '"Taktik tercihtir, bu kadar."', effect: { pressRelation: 1 } },
        { text: '"Oynayanlar ellerinden geleni yaptı."', effect: { teamMorale: 1, pressRelation: 0 } },
        { text: '"Bu soruyu geçiyorum."', effect: { pressRelation: -1 } },
      ],
    },
    {
      question: 'Grupta durumunuz nasıl?',
      options: [
        { text: '"İyi konumdayız, devam."', effect: { boardConfidence: 1, pressRelation: 1 } },
        { text: '"Her puan önemli, kazanmaya devam."', effect: { pressRelation: 1 } },
        { text: '"Hesapları maç bittikçe yaparız."', effect: { pressRelation: 0 } },
      ],
    },
    {
      question: 'İkinci yarı daha iyi oynadınız. Devre arasında ne değiştirdiniz?',
      options: [
        { text: '"Baskı kurmalarını istedim."', effect: { boardConfidence: 1 } },
        { text: '"Oyuncularımı motive ettim."', effect: { teamMorale: 1, pressRelation: 1 } },
        { text: '"Detayları paylaşmam."', effect: { pressRelation: 0 } },
      ],
    },
    {
      question: 'Bu tempoyla sonuç alınabilir mi?',
      options: [
        { text: '"İnancımı kaybetmiyorum."', effect: { boardConfidence: 1, pressRelation: 1 } },
        { text: '"İyileştirme alanlarımız var."', effect: { pressRelation: 1 } },
        { text: '"Takım çalışıyor, bu önemli."', effect: { pressRelation: 0 } },
      ],
    },
  ],

  afterBigWin: [
    {
      question: 'Büyük galibiyet! Artık şampiyonluk konuşulur mu?',
      options: [
        { text: '"Maç maç bakıyoruz, hâlâ erken."', effect: { pressRelation: 1 } },
        { text: '"Neden konuşulmasın? Gidiyoruz!"', effect: { boardConfidence: 2, pressRelation: 1, teamMorale: 1 } },
        { text: '"Erken konuşmak istemiyorum."', effect: { pressRelation: 0 } },
      ],
    },
    {
      question: 'Bu kadar gol atılması nasıl bir duygu?',
      options: [
        { text: '"Harika, hücum etkinliğimiz tepedeydi."', effect: { pressRelation: 1, teamMorale: 1 } },
        { text: '"Oyuncularım bugün rüzgar gibiydi."', effect: { teamMorale: 2, pressRelation: 1 } },
        { text: '"Çok istedik ve yaptık."', effect: { pressRelation: 1, boardConfidence: 1 } },
      ],
    },
    {
      question: 'Rakip bu kadar gol yedi. Ona acıdınız mı?',
      options: [
        { text: '"Futbolda bu olabiliyor."', effect: { pressRelation: 1 } },
        { text: '"Rakibe saygım var, bu futbol."', effect: { pressRelation: 2 } },
        { text: '"Biz sadece oynamak zorundaydık."', effect: { pressRelation: 0 } },
      ],
    },
    {
      question: 'Bu skor takımın özgüvenine ne katacak?',
      options: [
        { text: '"Her şeyi katacak. Biz güçlüyüz."', effect: { teamMorale: 2, boardConfidence: 2, pressRelation: 1 } },
        { text: '"Motivasyon arttı ama dikkatli kalacağız."', effect: { pressRelation: 1, teamMorale: 1 } },
        { text: '"Bir maç her şeyi değiştirmez."', effect: { pressRelation: 1 } },
      ],
    },
    {
      question: 'Bu takımı bu kadar güçlü yapan ne?',
      options: [
        { text: '"Birlik, baskı ve hız."', effect: { pressRelation: 1, boardConfidence: 1 } },
        { text: '"Takım kimyamız çok iyi şu an."', effect: { teamMorale: 1, pressRelation: 1 } },
        { text: '"Her departman bugün mükemmeldi."', effect: { pressRelation: 2 } },
      ],
    },
    {
      question: 'Dünya bu maçı konuşacak. Yorumunuz?',
      options: [
        { text: '"Gurur verici. Layık olduğumuzu gösterdik."', effect: { teamMorale: 2, boardConfidence: 1 } },
        { text: '"Odak bir sonraki maçta olmalı."', effect: { pressRelation: 1 } },
        { text: '"Bu sadece bir adım. Daha fazlası gelecek."', effect: { pressRelation: 1, boardConfidence: 1 } },
      ],
    },
    {
      question: 'Tarihî bir galibiyet mi bu?',
      options: [
        { text: '"Tarih yazıyoruz, evet!"', effect: { teamMorale: 2, pressRelation: 1, boardConfidence: 2 } },
        { text: '"Güzel bir an ama kazanmaya devam."', effect: { pressRelation: 1 } },
        { text: '"Bu takım çok şey başarabilir."', effect: { pressRelation: 1, teamMorale: 1 } },
      ],
    },
  ],
}
