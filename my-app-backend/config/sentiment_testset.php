<?php
/*
  Hand-labelled sentiment test set (the "gold standard").

  45 realistic visitor comments in English, Filipino and Taglish, balanced
  15 / 15 / 15 across the three classes. Originally written for the mobile
  app's Dart classifier and ported here unchanged, so that the SAME set
  measures the PHP engine that now classifies for both the app and the web.

  Balanced on purpose: with equal class sizes, a classifier that blindly
  guesses one label scores 33%, so accuracy is meaningful without having
  to correct for class imbalance.
*/

$TCIMS_TEST_SET = [
    ["comment" => "The church was very beautiful and the staff were friendly.", "expected" => "Positive"],
    ["comment" => "Excellent heritage trail, I really enjoyed the experience.", "expected" => "Positive"],
    ["comment" => "Very clean and well organized. Highly recommend.", "expected" => "Positive"],
    ["comment" => "Maganda ang simbahan at malinis ang paligid.", "expected" => "Positive"],
    ["comment" => "Sobrang ganda ng lugar, sulit ang punta.", "expected" => "Positive"],
    ["comment" => "The staff were helpful and the place felt safe.", "expected" => "Positive"],
    ["comment" => "Amazing experience, the guides were informative.", "expected" => "Positive"],
    ["comment" => "Salamat sa mabilis at maayos na serbisyo.", "expected" => "Positive"],
    ["comment" => "Great app, easy to use and very convenient.", "expected" => "Positive"],
    ["comment" => "Loved the historic churches, well preserved.", "expected" => "Positive"],
    ["comment" => "Ang galing ng programa, masaya kami.", "expected" => "Positive"],
    ["comment" => "Affordable and worth the visit. Thank you!", "expected" => "Positive"],
    ["comment" => "The festival was wonderful and well attended.", "expected" => "Positive"],
    ["comment" => "Peaceful and comfortable place to visit.", "expected" => "Positive"],
    ["comment" => "Napakabait ng mga staff, mabilis ang proseso.", "expected" => "Positive"],
    ["comment" => "The area was dirty and the staff were rude.", "expected" => "Negative"],
    ["comment" => "Terrible experience, very disappointing service.", "expected" => "Negative"],
    ["comment" => "Too crowded and the queue was extremely slow.", "expected" => "Negative"],
    ["comment" => "Madumi ang palikuran at mabagal ang serbisyo.", "expected" => "Negative"],
    ["comment" => "Hindi maganda, sobrang dumi ng lugar.", "expected" => "Negative"],
    ["comment" => "The signage was confusing and hard to follow.", "expected" => "Negative"],
    ["comment" => "Poor maintenance, many facilities are broken.", "expected" => "Negative"],
    ["comment" => "Delikado ang daan at walang ilaw sa gabi.", "expected" => "Negative"],
    ["comment" => "Worst service I have experienced, very unorganized.", "expected" => "Negative"],
    ["comment" => "Masyadong mahal at kulang ang pasilidad.", "expected" => "Negative"],
    ["comment" => "The place was neglected and smelly.", "expected" => "Negative"],
    ["comment" => "Baha agad kapag umuulan, delikado.", "expected" => "Negative"],
    ["comment" => "Not good at all, the tour was a waste of time.", "expected" => "Negative"],
    ["comment" => "Pangit ang kalsada at maraming basura.", "expected" => "Negative"],
    ["comment" => "Unsafe and poorly lit, I would not return.", "expected" => "Negative"],
    ["comment" => "I visited the church last Sunday afternoon.", "expected" => "Neutral"],
    ["comment" => "The event starts at nine in the morning.", "expected" => "Neutral"],
    ["comment" => "There are nine heritage churches on the trail.", "expected" => "Neutral"],
    ["comment" => "Pumunta ako sa city hall kahapon.", "expected" => "Neutral"],
    ["comment" => "I would like to ask about the schedule of the festival.", "expected" => "Neutral"],
    ["comment" => "The office is located near the main road.", "expected" => "Neutral"],
    ["comment" => "May tanong ako tungkol sa requirements.", "expected" => "Neutral"],
    ["comment" => "I downloaded the app yesterday.", "expected" => "Neutral"],
    ["comment" => "The tour takes about two hours to complete.", "expected" => "Neutral"],
    ["comment" => "Ilan po ang bayad para sa entrance?", "expected" => "Neutral"],
    ["comment" => "Please send the details to my email address.", "expected" => "Neutral"],
    ["comment" => "The building was constructed in 1863.", "expected" => "Neutral"],
    ["comment" => "Nagpunta kami ng pamilya ko noong Sabado.", "expected" => "Neutral"],
    ["comment" => "I am asking for the list of accredited establishments.", "expected" => "Neutral"],
    ["comment" => "The map shows the location of each stop.", "expected" => "Neutral"],
];
