/** Press conference question pool — TR and EN questions/options. */

export type PressCategory = 'afterWin' | 'afterLoss' | 'afterDraw' | 'afterBigWin'

export interface PressChoice {
  text: { tr: string; en: string }
  effect: {
    pressRelation?: number
    teamMorale?: number
    boardConfidence?: number
  }
}

export interface PressQuestion {
  question: { tr: string; en: string }
  /** [BENCHED_STAR] and [DROPPED_PLAYER] replaced at render time. */
  options: PressChoice[]
}

export const PRESS_QUESTIONS: Record<PressCategory, PressQuestion[]> = {
  afterWin: [
    {
      question: {
        tr: 'Güzel galibiyet. Bu performansın sırrı ne?',
        en: 'A fine win. What was the secret behind that performance?',
      },
      options: [
        { text: { tr: '"Sırrı yok, çok çalıştık."', en: '"No secret — we just worked hard."' }, effect: { pressRelation: 1 } },
        { text: { tr: '"Taktiksel olarak rakibi okuduk."', en: '"We read the opposition tactically."' }, effect: { boardConfidence: 1 } },
        { text: { tr: '"Bugün biraz şans da vardı tabii."', en: '"There was a bit of luck today, to be fair."' }, effect: { pressRelation: 2, boardConfidence: -1 } },
      ],
    },
    {
      question: {
        tr: 'Rakip güçlüydü. Nasıl üstün geldiniz?',
        en: 'The opponents were strong. How did you come out on top?',
      },
      options: [
        { text: { tr: '"Defansif bloğumuz müthişti."', en: '"Our defensive shape was outstanding."' }, effect: { pressRelation: 1 } },
        { text: { tr: '"Oyuncularım canlarını dişlerine taktı."', en: '"My players gave everything they had."' }, effect: { teamMorale: 1 } },
        { text: { tr: '"Rakibi küçümsemiyoruz, ama biz daha hazırlıklıydık."', en: '"We respect them, but we were better prepared."' }, effect: { pressRelation: 1 } },
      ],
    },
    {
      question: {
        tr: 'Bu galibiyet hedeflerinizi değiştiriyor mu?',
        en: 'Does this win change your ambitions?',
      },
      options: [
        { text: { tr: '"Maç maç bakıyoruz, daha erken."', en: '"We take it game by game — it\'s too early to say."' }, effect: { pressRelation: 1 } },
        { text: { tr: '"Neden değiştirsin? Şampiyonluğa gidiyoruz."', en: '"Why would it? We\'re going for the title."' }, effect: { boardConfidence: 2, teamMorale: 1 } },
        { text: { tr: '"Odaklanmaya devam ediyoruz."', en: '"We stay focused and keep going."' }, effect: { pressRelation: 1, boardConfidence: 1 } },
      ],
    },
    {
      question: {
        tr: '[BENCHED_STAR] bugün sahada yoktu. Neden?',
        en: "[BENCHED_STAR] wasn't in the starting XI today. Why?",
      },
      options: [
        { text: { tr: '"Taktik bir tercih, her oyuncuya ihtiyacımız var."', en: '"A tactical choice — I need every player in this squad."' }, effect: { pressRelation: 1 } },
        { text: { tr: '"Rotasyon yaptım, turnuva uzun."', en: '"I rotated — it\'s a long tournament."' }, effect: { pressRelation: 2 } },
        { text: { tr: '"Bu konuyu soyunma odasında konuşuruz."', en: '"That\'s a conversation for the dressing room."' }, effect: { pressRelation: 0 } },
      ],
    },
    {
      question: {
        tr: 'Taraftarlar harika bir atmosfer yarattı. Ne hissettiniz?',
        en: 'The fans created an incredible atmosphere. How did that feel?',
      },
      options: [
        { text: { tr: '"12. oyuncumuz onlar, çok teşekkürler."', en: '"They\'re our twelfth man — huge thanks to them."' }, effect: { pressRelation: 2, teamMorale: 1 } },
        { text: { tr: '"Onlar için oynadık bugün."', en: '"We played for them today."' }, effect: { pressRelation: 1, teamMorale: 1 } },
        { text: { tr: '"Her zaman güç veriyorlar bize."', en: '"They always give us a lift."' }, effect: { pressRelation: 1 } },
      ],
    },
    {
      question: {
        tr: 'Maçta öne çıkan oyuncu kimdi?',
        en: 'Who stood out for you in the match?',
      },
      options: [
        { text: { tr: '"Hepsinden söz etmek isterim. Takım olarak kazandık."', en: '"I\'d mention all of them — we won as a team."' }, effect: { teamMorale: 2, pressRelation: 1 } },
        { text: { tr: '"Kalecimiz bugün müthişti."', en: '"Our goalkeeper was outstanding today."' }, effect: { teamMorale: 1, pressRelation: 1 } },
        { text: { tr: '"Birini öne çıkarmak istemiyorum."', en: '"I don\'t want to single anyone out."' }, effect: { pressRelation: -1 } },
      ],
    },
    {
      question: {
        tr: 'Önümüzdeki rakip için hazırlık nasıl?',
        en: 'How is preparation going for the next opponent?',
      },
      options: [
        { text: { tr: '"Şimdiden başladık analiz etmeye."', en: '"We\'ve already started our analysis."' }, effect: { boardConfidence: 1 } },
        { text: { tr: '"Bu geceyi kutlayalım, yarın işe koyuluruz."', en: '"Let\'s enjoy tonight — we get back to work tomorrow."' }, effect: { pressRelation: 1 } },
        { text: { tr: '"Her rakibe saygıyla yaklaşıyoruz."', en: '"We approach every opponent with respect."' }, effect: { pressRelation: 1, boardConfidence: 1 } },
      ],
    },
    {
      question: {
        tr: 'Devre arasında ne söylediniz oyunculara?',
        en: 'What did you say to the players at half-time?',
      },
      options: [
        { text: { tr: '"Doğru ayarlamaları yaptık ve işe yaradı."', en: '"We made the right adjustments and they worked."' }, effect: { boardConfidence: 2, pressRelation: 1 } },
        { text: { tr: '"Oyuncularıma güveniyorum, onlar buldu çözümü."', en: '"I trust my players — they found the solution themselves."' }, effect: { teamMorale: 1, pressRelation: 1 } },
        { text: { tr: '"Soyunma odası sırrı kalır."', en: '"What\'s said in the dressing room stays there."' }, effect: { pressRelation: 1 } },
      ],
    },
  ],

  afterLoss: [
    {
      question: {
        tr: '3-0\'dı. Ne yanlış gitti bugün?',
        en: 'It finished 3-0. What went wrong today?',
      },
      options: [
        { text: { tr: '"Savunmamız çöktü, kabul ediyorum."', en: '"Our defence collapsed — I accept that."' }, effect: { pressRelation: 1, boardConfidence: -1 } },
        { text: { tr: '"Rakip bugün her şeyi doğru yaptı."', en: '"The opposition did everything right today."' }, effect: { pressRelation: 0 } },
        { text: { tr: '"Şu an analiz etmek erken."', en: '"It\'s too early to analyse right now."' }, effect: { pressRelation: -2 } },
      ],
    },
    {
      question: {
        tr: '[BENCHED_STAR] oynamadı. Bu yenilgiyle bağlantılı mı?',
        en: "[BENCHED_STAR] didn't play. Was that connected to the defeat?",
      },
      options: [
        { text: { tr: '"Tamamen taktik bir karardı."', en: '"It was entirely a tactical decision."' }, effect: { pressRelation: 0 } },
        { text: { tr: '"Oynayanlar ellerinden geleni yaptı."', en: '"The players who were out there gave their all."' }, effect: { teamMorale: 1, pressRelation: -1 } },
        { text: { tr: '"Bu soruyu geçiyorum."', en: '"I\'ll pass on that question."' }, effect: { pressRelation: -1 } },
      ],
    },
    {
      question: {
        tr: 'Taraftarlar hayal kırıklığı içinde ayrıldı. Onlara ne söylemek istersiniz?',
        en: 'The fans left disappointed. What would you like to say to them?',
      },
      options: [
        { text: { tr: '"Özür dileriz. Bir dahakine farklı olacak."', en: '"We\'re sorry. It will be different next time."' }, effect: { pressRelation: 2 } },
        { text: { tr: '"Destekleri her zaman güç veriyor."', en: '"Their support always means so much to us."' }, effect: { pressRelation: 1 } },
        { text: { tr: '"Biz de istedik ama olmadı."', en: '"We wanted it too — it just didn\'t happen."' }, effect: { pressRelation: 0 } },
      ],
    },
    {
      question: {
        tr: 'Rakibin golü hangi anda oyunu kırdı?',
        en: "Which goal broke the game open?",
      },
      options: [
        { text: { tr: '"İlk gol sonrası moralimiz bozuldu."', en: '"Our heads dropped after the first goal."' }, effect: { pressRelation: 1 } },
        { text: { tr: '"Biz fırsatları değerlendiremedik, asıl sorun bu."', en: '"We didn\'t take our chances — that\'s the real issue."' }, effect: { pressRelation: 2 } },
        { text: { tr: '"Rakip her alanda üstündü bugün."', en: '"The opposition were better in every area today."' }, effect: { pressRelation: 0 } },
      ],
    },
    {
      question: {
        tr: 'Kadro değişikliği olacak mı bir sonraki maçta?',
        en: 'Will you make changes to the squad for the next match?',
      },
      options: [
        { text: { tr: '"Değerlendirme yapacağız."', en: '"We\'ll assess everything."' }, effect: { pressRelation: 1, boardConfidence: -1 } },
        { text: { tr: '"Oyuncularımıza güveniyorum."', en: '"I believe in my players."' }, effect: { pressRelation: 0, teamMorale: 1 } },
        { text: { tr: '"Her zaman en iyi 11\'i seçerim."', en: '"I always pick the best eleven."' }, effect: { pressRelation: 1 } },
      ],
    },
    {
      question: {
        tr: 'Nasıl toparlanacaksınız?',
        en: 'How will you bounce back from this?',
      },
      options: [
        { text: { tr: '"Analiz edip daha güçlü geleceğiz."', en: '"We\'ll analyse it and come back stronger."' }, effect: { boardConfidence: 1, pressRelation: 1 } },
        { text: { tr: '"Takımımın karakterine güveniyorum."', en: '"I believe in the character of this team."' }, effect: { teamMorale: 1, pressRelation: 1 } },
        { text: { tr: '"Şu an bunu konuşmak zor."', en: '"It\'s hard to talk about it right now."' }, effect: { pressRelation: -1 } },
      ],
    },
    {
      question: {
        tr: 'İlk yarı çok kötüydü. Devre arası ne söylediniz?',
        en: 'The first half was very poor. What did you say at the break?',
      },
      options: [
        { text: { tr: '"Doğru analiz yapamadık, kabul."', en: '"We didn\'t read the game well enough — I admit that."' }, effect: { pressRelation: 1 } },
        { text: { tr: '"Rakip çok iyi çıktı, şans da onlardaydı."', en: '"The opposition came out strong and luck was on their side."' }, effect: { pressRelation: 0 } },
        { text: { tr: '"Düzelttik ama geç kaldık maalesef."', en: '"We corrected it but unfortunately it was too late."' }, effect: { pressRelation: 1 } },
      ],
    },
    {
      question: {
        tr: 'Kendinizi sorguluyor musunuz hoca?',
        en: 'Are you questioning yourself, manager?',
      },
      options: [
        { text: { tr: '"Her yenilginin ardından sorgulanmak gerekir."', en: '"You have to ask questions of yourself after every defeat."' }, effect: { pressRelation: 2 } },
        { text: { tr: '"Sürece güveniyorum."', en: '"I trust the process."' }, effect: { pressRelation: 0, boardConfidence: 1 } },
        { text: { tr: '"Tek bir maç her şeyi değiştirmez."', en: '"One match doesn\'t change everything."' }, effect: { pressRelation: 0 } },
      ],
    },
  ],

  afterDraw: [
    {
      question: {
        tr: 'Beraberlik yeterliydi sizin için?',
        en: 'Was a draw enough for you?',
      },
      options: [
        { text: { tr: '"Dürüst olacağım: kazanmak isterdik."', en: '"I\'ll be honest — we wanted the win."' }, effect: { pressRelation: 1 } },
        { text: { tr: '"Bu rakibe karşı puan almak önemliydi."', en: '"Taking a point against this team was important."' }, effect: { pressRelation: 1, boardConfidence: 1 } },
        { text: { tr: '"Verdiğimizi aldık bugün."', en: '"We got what we deserved today."' }, effect: { pressRelation: 0 } },
      ],
    },
    {
      question: {
        tr: 'Gol fırsatları harcandı. Niçin?',
        en: 'Chances were squandered. Why?',
      },
      options: [
        { text: { tr: '"Şans bugün yüzümüze gülmedi."', en: '"Luck wasn\'t on our side today."' }, effect: { pressRelation: 0 } },
        { text: { tr: '"Hücum etkinliğimizi artıracağız."', en: '"We\'ll improve our attacking efficiency."' }, effect: { pressRelation: 1, boardConfidence: 1 } },
        { text: { tr: '"Rakip kalecisi iyi oynadı."', en: '"Their goalkeeper played well."' }, effect: { pressRelation: 1 } },
      ],
    },
    {
      question: {
        tr: '[BENCHED_STAR] yoktu. Sonucu etkiliyor muydu?',
        en: "[BENCHED_STAR] was absent. Did that affect the result?",
      },
      options: [
        { text: { tr: '"Taktik tercihtir, bu kadar."', en: '"It\'s a tactical choice — simple as that."' }, effect: { pressRelation: 1 } },
        { text: { tr: '"Oynayanlar ellerinden geleni yaptı."', en: '"The players on the pitch gave their all."' }, effect: { teamMorale: 1, pressRelation: 0 } },
        { text: { tr: '"Bu soruyu geçiyorum."', en: '"I\'ll pass on that one."' }, effect: { pressRelation: -1 } },
      ],
    },
    {
      question: {
        tr: 'Grupta durumunuz nasıl?',
        en: 'How do you see your group standings?',
      },
      options: [
        { text: { tr: '"İyi konumdayız, devam."', en: '"We\'re in a good position — we push on."' }, effect: { boardConfidence: 1, pressRelation: 1 } },
        { text: { tr: '"Her puan önemli, kazanmaya devam."', en: '"Every point matters — we keep winning."' }, effect: { pressRelation: 1 } },
        { text: { tr: '"Hesapları maç bittikçe yaparız."', en: '"We\'ll do the maths as matches are played."' }, effect: { pressRelation: 0 } },
      ],
    },
    {
      question: {
        tr: 'İkinci yarı daha iyi oynadınız. Devre arasında ne değiştirdiniz?',
        en: 'You were much better in the second half. What changed at the break?',
      },
      options: [
        { text: { tr: '"Baskı kurmalarını istedim."', en: '"I asked them to press higher."' }, effect: { boardConfidence: 1 } },
        { text: { tr: '"Oyuncularımı motive ettim."', en: '"I motivated the players."' }, effect: { teamMorale: 1, pressRelation: 1 } },
        { text: { tr: '"Detayları paylaşmam."', en: '"I don\'t share the details."' }, effect: { pressRelation: 0 } },
      ],
    },
    {
      question: {
        tr: 'Bu tempoyla sonuç alınabilir mi?',
        en: 'Can you get results at this level of performance?',
      },
      options: [
        { text: { tr: '"İnancımı kaybetmiyorum."', en: '"I\'m not losing faith."' }, effect: { boardConfidence: 1, pressRelation: 1 } },
        { text: { tr: '"İyileştirme alanlarımız var."', en: '"There are areas we need to improve."' }, effect: { pressRelation: 1 } },
        { text: { tr: '"Takım çalışıyor, bu önemli."', en: '"The team is working hard — that matters."' }, effect: { pressRelation: 0 } },
      ],
    },
  ],

  afterBigWin: [
    {
      question: {
        tr: 'Büyük galibiyet! Artık şampiyonluk konuşulur mu?',
        en: "What a win! Can we start talking about the title now?",
      },
      options: [
        { text: { tr: '"Maç maç bakıyoruz, hâlâ erken."', en: '"We\'re taking it game by game — still too early."' }, effect: { pressRelation: 1 } },
        { text: { tr: '"Neden konuşulmasın? Gidiyoruz!"', en: '"Why not? We\'re going for it!"' }, effect: { boardConfidence: 2, pressRelation: 1, teamMorale: 1 } },
        { text: { tr: '"Erken konuşmak istemiyorum."', en: '"I don\'t want to talk about it yet."' }, effect: { pressRelation: 0 } },
      ],
    },
    {
      question: {
        tr: 'Bu kadar gol atılması nasıl bir duygu?',
        en: 'What does it feel like to score so many goals?',
      },
      options: [
        { text: { tr: '"Harika, hücum etkinliğimiz tepedeydi."', en: '"Brilliant — our attacking efficiency was at its peak."' }, effect: { pressRelation: 1, teamMorale: 1 } },
        { text: { tr: '"Oyuncularım bugün rüzgar gibiydi."', en: '"My players were like the wind today."' }, effect: { teamMorale: 2, pressRelation: 1 } },
        { text: { tr: '"Çok istedik ve yaptık."', en: '"We really wanted it — and we delivered."' }, effect: { pressRelation: 1, boardConfidence: 1 } },
      ],
    },
    {
      question: {
        tr: 'Rakip bu kadar gol yedi. Ona acıdınız mı?',
        en: 'The opposition conceded a lot. Did you feel any sympathy?',
      },
      options: [
        { text: { tr: '"Futbolda bu olabiliyor."', en: '"It happens in football."' }, effect: { pressRelation: 1 } },
        { text: { tr: '"Rakibe saygım var, bu futbol."', en: '"I have respect for them — this is football."' }, effect: { pressRelation: 2 } },
        { text: { tr: '"Biz sadece oynamak zorundaydık."', en: '"We just had to play our game."' }, effect: { pressRelation: 0 } },
      ],
    },
    {
      question: {
        tr: 'Bu skor takımın özgüvenine ne katacak?',
        en: "What will this scoreline do for the team's confidence?",
      },
      options: [
        { text: { tr: '"Her şeyi katacak. Biz güçlüyüz."', en: '"Everything. We are strong."' }, effect: { teamMorale: 2, boardConfidence: 2, pressRelation: 1 } },
        { text: { tr: '"Motivasyon arttı ama dikkatli kalacağız."', en: '"Motivation is up but we\'ll stay focused."' }, effect: { pressRelation: 1, teamMorale: 1 } },
        { text: { tr: '"Bir maç her şeyi değiştirmez."', en: '"One match doesn\'t change everything."' }, effect: { pressRelation: 1 } },
      ],
    },
    {
      question: {
        tr: 'Bu takımı bu kadar güçlü yapan ne?',
        en: 'What makes this team so strong?',
      },
      options: [
        { text: { tr: '"Birlik, baskı ve hız."', en: '"Unity, pressing, and pace."' }, effect: { pressRelation: 1, boardConfidence: 1 } },
        { text: { tr: '"Takım kimyamız çok iyi şu an."', en: '"Our team chemistry is excellent right now."' }, effect: { teamMorale: 1, pressRelation: 1 } },
        { text: { tr: '"Her departman bugün mükemmeldi."', en: '"Every department was excellent today."' }, effect: { pressRelation: 2 } },
      ],
    },
    {
      question: {
        tr: 'Dünya bu maçı konuşacak. Yorumunuz?',
        en: 'The world will be talking about this. Your thoughts?',
      },
      options: [
        { text: { tr: '"Gurur verici. Layık olduğumuzu gösterdik."', en: '"Incredibly proud. We showed we deserve to be here."' }, effect: { teamMorale: 2, boardConfidence: 1 } },
        { text: { tr: '"Odak bir sonraki maçta olmalı."', en: '"The focus has to shift to the next match."' }, effect: { pressRelation: 1 } },
        { text: { tr: '"Bu sadece bir adım. Daha fazlası gelecek."', en: '"This is just one step. There\'s more to come."' }, effect: { pressRelation: 1, boardConfidence: 1 } },
      ],
    },
    {
      question: {
        tr: 'Tarihî bir galibiyet mi bu?',
        en: 'Is this a historic victory?',
      },
      options: [
        { text: { tr: '"Tarih yazıyoruz, evet!"', en: '"We\'re making history — yes!"' }, effect: { teamMorale: 2, pressRelation: 1, boardConfidence: 2 } },
        { text: { tr: '"Güzel bir an ama kazanmaya devam."', en: '"A great moment, but we keep winning."' }, effect: { pressRelation: 1 } },
        { text: { tr: '"Bu takım çok şey başarabilir."', en: '"This team is capable of great things."' }, effect: { pressRelation: 1, teamMorale: 1 } },
      ],
    },
  ],
}
