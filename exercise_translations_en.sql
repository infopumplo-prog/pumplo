-- Exercise English Translations Migration
-- Generated 2026-05-06 | 201 exercises
-- Columns: name_en, description_en, setup_instructions_en

BEGIN;

UPDATE exercises SET
  name_en = '90/90 Hip Stretch', description_en = 'I sit so that my legs form a right angle at the knee. I perform the movement by pressing my feet into the floor and rotating my knees. To make it easier, I can assist with my hands.', setup_instructions_en = 'Sit on the floor. Bend both legs to a right angle at the knees - front leg in front, back leg behind you, both knees on the ground. Spine upright.'
WHERE id = 'cb34072d-d583-48b7-b868-579f01169677'; -- 90/90

UPDATE exercises SET
  name_en = 'Air Bike', description_en = 'The air bike (often called a ''fan bike'' or ''cardio tank'') is a stationary trainer with moving handles and a large front fan that uses air resistance. The faster you pedal and move your arms, the greater the resistance. It is the ideal machine for high-intensity interval training (HIIT) and developing overall fitness.', setup_instructions_en = '1. Adjust the seat and handlebar height so they are comfortable and ensure proper posture on the air bike.
2. Sit down and grip the handles. Keep your back straight and chest slightly forward.
3. Begin pedaling and move the handles rhythmically until you reach a comfortable workload.
4. Use smooth and controlled movements.'
WHERE id = '7636ae56-c0b2-4712-8a29-5582e4bf64a6'; -- Air bike

UPDATE exercises SET
  name_en = 'Bench Press', description_en = 'The bench press is a fundamental, multi-joint barbell exercise focused on developing strength and mass of the chest muscles (pectorals), shoulders (anterior deltoids), and arms (triceps). The exercise is performed lying on a bench, where the exerciser lowers an Olympic barbell to the chest and then presses it back up in a controlled manner.', setup_instructions_en = '1. Lie on a flat bench so the bar is directly above your eyes.
2. Grip the bar slightly wider than shoulder-width. Retract your shoulder blades and create a slight arch in your back.
3. Inhale and slowly lower the bar to your chest (approximately at nipple level).
4. Exhale and press the bar back up to full arm extension without locking out your elbows.'
WHERE id = '692879dc-a0ce-4c2a-9662-099f11dde0d2'; -- Bench press

UPDATE exercises SET
  name_en = 'Smith Machine Bench Press', description_en = '1. Lie on the bench with a slight arch, feet on the floor. With arms extended, unrack the bar from the rack.
2. Lower the bar to the upper abdomen/lower chest.
3. Press the bar up until the arms are fully extended.', setup_instructions_en = 'Set the bench under the Smith machine so the bar is just above the center of your chest when lowered. Set the safety stops slightly above chest height. Lie down, feet flat on the floor.'
WHERE id = 'edef89f1-3b9e-4c89-a948-ec7c61ede515'; -- Bench press na Smith stroji

UPDATE exercises SET
  name_en = 'Rack Bench Press', description_en = 'Bench press in a rack (half rack) is a fundamental multi-joint exercise for building strength and volume in the upper body. Training in the rack provides a higher level of safety thanks to adjustable safety stops that catch the bar in case of failure. The exercise primarily targets the pectoral muscles, but also significantly engages the triceps and anterior deltoids.', setup_instructions_en = '1. Place a flat bench in the center of the rack and set the hook height so you can comfortably reach the bar with slightly bent elbows.
2. Set the safety stops just below your chest level.
3. Lie on the bench, grip the bar with an overhand grip wider than shoulder-width, and retract your shoulder blades.
4. Inhale and slowly lower the bar to the lower portion of your chest.
5. Exhale and press the bar smoothly back to the starting position above your chest.'
WHERE id = '996f1e87-c2b5-4fa9-9b34-641a59d15e97'; -- Bench press v rámu

UPDATE exercises SET
  name_en = 'Bicep Curls', description_en = 'An isolated biceps exercise on a weight-stack machine. This machine locks the position of the elbows and torso, ensuring maximum concentration on bicep work without assistance from other muscle groups. Unlike plate-loaded machines, it offers smooth resistance and very quick load changes using the pin, making it ideal for drop sets.', setup_instructions_en = '1. Adjust the seat height so that the armpits rest comfortably on the upper edge of the pad.
2. Select the desired weight by inserting the pin into the weight stack.
3. Sit down, rest your arms on the pad, and grip the handles.
4. Exhale and smoothly curl the handles toward your shoulders.
5. At the top, squeeze the biceps for a second, then slowly return to the stretched position on the inhale.'
WHERE id = 'ea545531-ff7e-4aa8-9e92-e3816677aebf'; -- Bicepsové zdvihy

UPDATE exercises SET
  name_en = 'Machine Bicep Curls', description_en = 'A machine exercise for isolated biceps curls with resistance. The machine provides firm elbow support and isolates the biceps, eliminating shoulder and back involvement. It is ideal for achieving maximum peak contraction and precise shaping of the biceps peak. Constant tension throughout the full range of motion ensures effective muscle stimulation.', setup_instructions_en = '1. Adjust the seat height so that your armpits rest on top of the padded support.
2. Sit down and place your elbows on the pad.
3. Grip the machine handles with palms facing up.
4. Exhale and in a controlled manner curl the handles upward toward your shoulders.
5. At the top position, squeeze the biceps for a moment.
6. Inhale and slowly lower the handles back to the starting position.'
WHERE id = 'c88b45d2-1cd5-4225-99b3-89ce69245b09'; -- Bicepsové zdvihy na stroji

UPDATE exercises SET
  name_en = 'Bicep Curl', description_en = 'The EZ bar biceps curl is a foundational exercise for building arm mass and strength. The specific curve of the EZ bar allows a more natural grip, which significantly reduces stress on the wrists and elbows compared to a straight bar. Thanks to the stable stance and free weight, the exercise effectively engages both heads of the biceps and the deep brachialis muscle.', setup_instructions_en = '1. Stand upright with feet hip-width apart, holding the EZ bar in an underhand grip at the curved section.
2. Keep your elbows close to your body and your shoulders pressed down.
3. Exhale and smoothly curl the bar upward toward your shoulders.
4. At the top, maximally squeeze the biceps for a second.
5. Inhale and slowly and in a controlled manner lower the bar back to full arm extension.'
WHERE id = '5d5706e5-5123-4ad2-85ea-91f15c499116'; -- Bicepsový zdvih

UPDATE exercises SET
  name_en = 'Bicep Curl (Fantastic Machine)', description_en = 'The Fantastic Biceps Machine is a premium isolated machine for maximum biceps development. Its unique construction and biomechanics from the Fantastic series ensure perfectly smooth and constant resistance throughout the full range of motion. The ergonomic, curved handles allow natural wrist rotation, minimizing shoulder and back involvement while maximizing bicep isolation.', setup_instructions_en = '1. Adjust the seat height so that your armpits rest comfortably on the edge of the support pad.
2. Sit down, grip the handles (underhand grip), and rest the full length of your arms on the pad.
3. In a controlled movement, curl the handles toward your shoulders.
4. At the top, squeeze the biceps for a second, then slowly lower to near full extension.'
WHERE id = '2790d5d8-c3c9-49a5-8fce-bf29ba687560'; -- Bicepsový zdvih (Fantastic)

UPDATE exercises SET
  name_en = 'Low Cable Bicep Curl', description_en = 'The EZ bar low cable biceps curl is an excellent exercise for isolated biceps development. The curved shape of the EZ bar allows a more wrist-friendly grip and a more natural arm position. The cable ensures constant tension in the muscle throughout the entire range of motion, leading to more effective growth and strength stimulation compared to the free-weight version.', setup_instructions_en = '1. Set the cable to the lowest position and attach the EZ bar adapter.
2. Stand facing the machine with feet shoulder-width apart and grip the adapter underhand at the curved section.
3. Exhale and smoothly flex the elbows, curling the adapter toward your shoulders.
4. At the top, squeeze the biceps hard, keeping the elbows close to your body without swinging forward.
5. Inhale and in a controlled, slow manner lower the weight back to full arm extension.'
WHERE id = 'cc86417b-e220-405e-95f1-57c2b1baa44d'; -- Bicepsový zdvih na spodní kladce

UPDATE exercises SET
  name_en = 'Dumbbell Bicep Curl', description_en = 'The dumbbell biceps curl is an isolation exercise targeting the biceps brachii. Using dumbbells ensures both arms work equally, helping to correct muscular imbalances. The exercise can be performed alternately or with both arms simultaneously and allows natural wrist rotation (supination) for maximum muscle contraction.', setup_instructions_en = '1. Stand upright with dumbbells in both hands at your sides, palms facing your torso.
2. Brace your core, slightly retract your shoulder blades, and keep your chest up.
3. Exhale and in a controlled manner curl the dumbbell toward your shoulder, keeping the elbow fixed at your side.
4. Rotate your wrist palm-up (supination) during the movement.
5. At the top, squeeze the biceps hard, then inhale and slowly lower the dumbbell back to the starting position.'
WHERE id = 'c3370ba1-e953-452b-8d63-898e923a091c'; -- Bicepsový zdvih s jednoručkami

UPDATE exercises SET
  name_en = 'Kettlebell Bicep Curl', description_en = 'The kettlebell biceps curl is a variation of the traditional biceps curl that effectively isolates and strengthens the biceps brachii. Using kettlebells instead of standard dumbbells shifts the center of gravity of the load, which can increase demands on grip strength and forearm stability. The exercise is ideal for building arm muscle volume and strength.', setup_instructions_en = '1. Stand upright with feet shoulder-width apart.
2. Hold a kettlebell in each hand by the handle with palms facing forward (supinated grip).
3. Keep arms extended along your sides with elbows fixed at your hips.
4. Exhale and in a controlled manner curl the kettlebells toward your shoulders using only elbow flexion.
5. At the top, squeeze the biceps hard, then inhale and slowly lower to the starting position.'
WHERE id = '8417a8d3-e681-4dfa-978d-561cc4b1f8ab'; -- Bicepsový zdvih s kettlebellem

UPDATE exercises SET
  name_en = 'Bulgarian Split Squat with Dumbbells', description_en = 'The Bulgarian split squat is a unilateral exercise (focused on one leg) that excels at building lower limb strength, stability, and muscle mass. Elevating the rear foot increases the range of motion and places enormous demands on balance and the strength of the front leg. It is one of the best exercises for correcting strength imbalances between the left and right legs.', setup_instructions_en = '1. Stand a short distance in front of a bench or box, holding dumbbells in both hands at your sides.
2. Place the top of your rear foot on the bench behind you.
3. The front foot should be positioned so that the knee does not travel too far past the toe during the descent (unless you specifically want to target the quadriceps).
4. Inhale and lower in a controlled manner until the rear knee is just above the ground.
5. Exhale and drive through the full surface of the front foot to return to the starting position.'
WHERE id = '3941e05b-2528-4646-ada9-f3311105cfa1'; -- Bulharský dřep s jednoručkami

UPDATE exercises SET
  name_en = 'Bulgarian Split Squat with Kettlebell', description_en = 'The Bulgarian split squat with kettlebells is a unilateral exercise focused on developing leg and glute strength and muscle mass. Elevating the rear foot results in a deeper stretch and higher activation of the working muscles of the front leg. Using kettlebells increases the demands on core stability and helps correct strength imbalances between the left and right limbs.', setup_instructions_en = '1. Find a box or bench approximately at knee height.
2. Stand in front of the box, place one foot with the instep on its edge, and step forward with the other foot.
3. Hold a kettlebell in each hand at your sides.
4. Inhale and lower your hips straight down until the front thigh is parallel to the ground and the rear knee is just above the floor.
5. Exhale and drive through the heel of the front foot to return to the starting position.'
WHERE id = '0a4f82fb-6ab2-4379-9cfa-da3eef86543f'; -- Bulharský dřep s kettlebellem

UPDATE exercises SET
  name_en = 'Treadmill Running', description_en = 'Running on a treadmill is an effective cardiovascular exercise focused on developing endurance, burning calories, and strengthening the muscles of the lower limbs. The advantage is a constant pace and the ability to set incline to simulate uphill running, independent of weather.', setup_instructions_en = '1. Step onto the belt and clip the safety key to your clothing.
2. Press the Start button and begin with a slow walk (warm-up).
3. Gradually increase the speed to a level that allows smooth running.
4. Maintain an upright posture and breathe smoothly.'
WHERE id = '4636d4fc-3eeb-41a4-a2fb-32ebe0a6bf48'; -- Běh na běžeckém páse

UPDATE exercises SET
  name_en = 'Curved Treadmill Running', description_en = 'Running on a curved non-motorized treadmill is an intense, natural, and effective form of cardiovascular training. The belt is powered entirely by the user''s own force. The curved shape encourages the exerciser toward optimal forefoot running technique, which engages more muscles and burns approximately 30% more calories than a standard treadmill.', setup_instructions_en = '1. Stand on the belt and hold the handles for added stability at first.
2. Start slowly with walking until you get used to the mechanical resistance.
3. To increase speed, move forward along the curved surface.
4. To slow down, move backward along the curved surface (toward the rear of the machine).
5. Maintain an upright posture and breathe smoothly.'
WHERE id = 'cf4ec86b-ee2c-4c41-943b-b4597c48eae8'; -- Běh na prohnutém bezmotorovém pásu

UPDATE exercises SET
  name_en = 'Ski Ergometer', description_en = 'Stand upright with slightly bent knees, hands on top of the handles. The pull begins from the arms and flows smoothly through the core engagement down into a slight squat - as if you are ''pulling'' your body downward. The movement is smooth, not jerky, and the return upward is controlled without losing tension.', setup_instructions_en = 'Stand on the elliptical trainer pedals and grip the handles. Set the resistance and incline according to your training intensity. Back upright, knees slightly bent.'
WHERE id = 'd98e28c2-0e5c-4d61-bc8b-988dd21671c1'; -- Běžky

UPDATE exercises SET
  name_en = 'Treadmill Walking', description_en = 'Walking on a treadmill is the ideal low-impact activity, suitable for warm-up before training, active recovery, or fat burning in the aerobic zone. By adjusting the incline, it can also be very intense without the need to run.', setup_instructions_en = '1. Step onto the belt and clip the safety key.
2. Select a walking speed in the range of 4-6 km/h (or according to your fitness level).
3. If you want to increase intensity, raise the incline instead of the speed.
4. Walk naturally, look ahead, and let your arms swing freely at your sides.'
WHERE id = '83a16753-4aa4-46ed-9e95-294fc27c47de'; -- Chůze na běžeckém páse

UPDATE exercises SET
  name_en = 'Curved Treadmill Walking', description_en = 'Walking on a curved non-motorized treadmill is a highly effective form of natural movement. Unlike motorized belts, you must propel the belt with each step, which significantly increases glute and hamstring activation. It is ideal for practicing proper walking technique and active fat burning.', setup_instructions_en = '1. Step onto the center of the curved surface and lightly hold the handles for stability at first.
2. Take a step forward onto the curved section, setting the belt in motion.
3. Regulate your walking speed by your position: the further forward you walk, the faster the movement.
4. Aim for an upright posture, engage your core, and do not look down at your feet.'
WHERE id = '36bb3e0b-ed3a-4cac-957b-5301a9bc4c30'; -- Chůze na prohnutém bezmotorovém pásu

UPDATE exercises SET
  name_en = 'Stair Climbing', description_en = 'Stair climbing is a simple and effective exercise that can be performed anytime and anywhere. Climb the stairs at a natural pace and return to the bottom, repeating the ascent according to your fitness level. Tip: When climbing, step on the middle of each step and use the strength of your legs, not momentum. Move in a controlled manner and maintain an upright torso without leaning forward.', setup_instructions_en = 'Stand at a staircase or stepper. Maintain an upright position and look straight ahead. Place your entire foot on each step.'
WHERE id = 'eb2edb2e-3df4-4c8e-9d75-8bb74402ed00'; -- Chůze po schodech

UPDATE exercises SET
  name_en = 'Assisted Dips', description_en = '1. Grip the edge of the dip bars with both hands, keep your feet together and legs extended.
2. Lower your body straight down.
3. Slowly return to the starting position.
4. TIP: You can make the exercise harder by lifting your feet off the ground and adding weight.', setup_instructions_en = 'Set the machine to the desired assistance level and kneel or stand on the platform. Grip the handles with extended arms - the platform will assist by reducing your effective bodyweight.'
WHERE id = '979da830-93c1-4ba7-bbee-8a9248b939a0'; -- Dips s dopomocí

UPDATE exercises SET
  name_en = 'Band-Assisted Dips', description_en = '1. Attach a resistance band to both dip handles to create a loop for your knees or feet.
2. Brace yourself on the parallel bars with extended arms and rest your knees (or feet) on the band, which will assist by reducing your bodyweight.
3. Inhale and lower in a controlled manner by bending your elbows until your arms form approximately a 90-degree angle.
4. Exhale and press back up using your triceps and pectoral muscles to the starting position with extended arms.', setup_instructions_en = '1. Choose the resistance band according to your strength level - a stronger band provides greater assistance.
2. Make sure the band is securely attached and will not slip off.'
WHERE id = 'e1e265f8-a247-4e98-8fd5-90829e711654'; -- Dips s dopomocí gumy

UPDATE exercises SET
  name_en = 'Child''s Pose', description_en = 'I kneel, press my palms into the ground, and sit back onto my heels. I push my chest toward the ground.', setup_instructions_en = 'Kneel on the floor and sit back onto your heels. Extend your arms in front of you or place them along your body. Relax your back, forehead resting on the mat.'
WHERE id = '01565be0-d364-46cd-a730-885838b9c80b'; -- Dětská pozice

UPDATE exercises SET
  name_en = 'Squat', description_en = '1. Stand with a wide stance at shoulder width. Maintain a natural arch in your back by squeezing your shoulder blades and raising your chest.
2. Place the bar on your shoulders and support it with the upper part of your back. Unrack the bar by straightening your legs and step back.
3. Bend your knees and lower the weight without changing your back position until your hips are below your knees.
4. Drive the bar back to the starting position by pushing through your legs, and exhale at the top.', setup_instructions_en = 'Set the bar in the rack at shoulder height. Step under the bar and place it on your upper back (trapezius). Grip the bar slightly wider than shoulder-width. Step back out of the rack with two steps.'
WHERE id = 'f6d58125-f850-49e0-bfca-b18ac13dd77a'; -- Dřep

UPDATE exercises SET
  name_en = 'Smith Machine Squat', description_en = '1. Stand with feet shoulder-width apart. Maintain the natural curve of your spine and place the bar on your back. Squeeze your shoulder blades and raise your chest.
2. Grip the bar across your shoulders and rest it against your upper back. Release the machine by straightening your legs.
3. Bend your knees and lower the weight without changing your back position until your hips are below your knees.
4. Drive the bar back to the starting position by pushing through your legs and exhale at the top.', setup_instructions_en = 'Set the safety stops just below squat depth. Step under the bar and place it on your upper back. Feet slightly in front of the bar. Unlock the machine by rotating.'
WHERE id = 'dbaa46c7-5ca4-46da-9ed1-7436d10f88d2'; -- Dřep na Smith stroji

UPDATE exercises SET
  name_en = 'Belt Squat', description_en = '1. Attach the machine belt around your hips and stand on the platform with a medium-width stance.
2. Stand upright to lift the weight and unlock the safety lever.
3. Inhale and lower in a controlled manner into a squat until your thighs are at least parallel to the platform.
4. Exhale and drive through your full feet back to the starting position while maintaining an upright torso.', setup_instructions_en = '1. Select an appropriate chain or strap length so that the belt is taut even at a slight squat.
2. Load the appropriate weight onto the machine pegs.'
WHERE id = 'b11d2e93-9cfd-4cd6-b592-7126516ac6aa'; -- Dřep s opaskem

UPDATE exercises SET
  name_en = 'Rack Squat', description_en = 'The barbell squat in a rack (half rack) is the king of exercises for developing lower limb strength and muscle mass. Training in the rack allows safe barbell loading on the back and provides protection via safety stops in case of failure. This compound movement engages the quadriceps, hamstrings, glutes, and core stabilizing muscles.', setup_instructions_en = '1. Set the hook height so the barbell is just below shoulder level.
2. Set the safety stops to the height corresponding to the bottom phase of your squat.
3. Step under the bar, rest it on your upper trapezius, brace your back, and unrack the bar.
4. Step back, stand shoulder-width apart, and inhale while descending in a controlled manner (maintain the natural curve of your spine).
5. Exhale and drive smoothly back to the upright position using your leg strength.'
WHERE id = '3d2f2437-597e-455d-b8a1-c7f46825795f'; -- Dřep v rámu

UPDATE exercises SET
  name_en = 'Goblet Squat with Dumbbell', description_en = 'The goblet squat is a squat variation in which the weight is held with both hands in front of the chest. This position of the center of gravity makes it easier to maintain an upright torso and correct technique, making it a safer alternative to the back squat. The exercise effectively builds lower limb strength while also demanding core stability.', setup_instructions_en = '1. Stand with feet slightly wider than shoulder-width, toes turned out slightly.
2. Grip a dumbbell with both hands by one of its heads and hold it close to your chest (like a goblet).
3. Inhale and lower in a controlled manner into a squat, keeping your back flat and chest up.
4. At the bottom, your elbows should point toward the inside of your knees.
5. Exhale and drive through your full feet to return to the starting position.'
WHERE id = 'a325e2f1-f12e-47a0-add7-f1b7aefedd1d'; -- Goblet dřep s jednoručkou

UPDATE exercises SET
  name_en = 'Goblet Squat with Kettlebell', description_en = 'The kettlebell goblet squat is a foundational compound exercise ideal for practicing proper deep squat technique. Holding the weight in front of the chest helps maintain an upright torso and activates the core, protecting the lower back. The exercise effectively builds thigh and glute strength and improves hip mobility.', setup_instructions_en = '1. Stand with feet slightly wider than shoulder-width, toes turned out slightly.
2. Grip the kettlebell with both hands on the sides of the handle (the ''horns'') and hold it close to the upper chest.
3. Point your elbows downward toward your body.
4. Inhale and lower in a controlled manner into a squat (as if sitting in a chair) until your thighs are at least parallel to the ground.
5. At the bottom position, your elbows should end up inside your knees.
6. Exhale and drive through the full foot (particularly the heels) to return to an upright stance.'
WHERE id = 'ef2181b9-331e-455c-84b0-9355e9900911'; -- Goblet dřep s kettlebellem

UPDATE exercises SET
  name_en = 'Smith Machine Hip Thrust', description_en = '1. Sit on the floor with a bench behind you. Place the bar across your legs just above your hips.
2. Lean back against the bench so your shoulders rest on it. Extend your arms to the sides with support against the bench.
3. Lift the weight by driving through your feet and pushing your hips upward. Support the weight with your shoulders and feet.
4. Slowly extend as far as possible, then slowly return to the starting position.', setup_instructions_en = 'Position the bench in front of the Smith machine. Rest your shoulder blades against the edge of the bench. Set the bar height to hip level in the bottom position. Insert a pad between the bar and your hips.'
WHERE id = '4b5aed09-fac8-4c42-a354-f2946cdd259d'; -- Hip thrust na Smith stroji

UPDATE exercises SET
  name_en = 'Plate-Loaded Machine Hip Thrust', description_en = 'The plate-loaded hip thrust machine is designed for maximum glute overload while maintaining complete safety. The machine''s mechanics precisely replicate the natural arc of the hip movement, allowing a deeper stretch in the bottom phase and an extreme contraction in the top position. Using plates gives the exerciser the ability to precisely dose the load and the feel of working with free weights, but with the advantage of a fixed movement path.', setup_instructions_en = '1. Load the appropriate number of plates onto the machine pegs.
2. Sit on the seat and lean your upper back against the padded support.
3. Secure yourself with the padded belt or moving arm of the machine across your pelvis.
4. Position your feet on the platform so that your shins are perpendicular to the ground at the top of the movement.
5. Exhale and drive the weight upward with your glutes, pausing briefly at the top.
6. Inhale and lower the weight in a controlled manner to the maximum glute stretch.'
WHERE id = '94024616-84bd-4248-819c-25007ef4eb99'; -- Hip thrust na stroji (kotoučový)

UPDATE exercises SET
  name_en = 'Dumbbell Hip Thrust', description_en = 'The dumbbell hip thrust is a highly effective exercise targeting the gluteus maximus and the posterior chain of the thighs. Compared to the barbell version, the dumbbell variant is more compact and often more comfortable to set up, while still allowing a high degree of glute activation thanks to the bench support, which increases the range of motion.', setup_instructions_en = '1. Rest your shoulder blades against the edge of a bench or box that will not move.
2. Place a dumbbell in the crease of your hips and hold it with both hands.
3. Keep your feet flat on the ground at hip-width, toes can point slightly outward.
4. Exhale and drive your hips toward the ceiling so that your knees form a 90-degree angle at the top and your body is in a straight line from shoulders to knees.
5. At the top, squeeze the glutes hard, then inhale and lower your hips in a controlled manner just above the ground.'
WHERE id = '85254cdb-2756-408a-99a5-77a577a39c7d'; -- Hip thrust s jednoručkou

UPDATE exercises SET
  name_en = 'Kettlebell Hip Thrust', description_en = 'The kettlebell hip thrust is a highly effective exercise for building glute strength and volume. Supporting the back on a bench allows a greater range of motion and stronger glute contraction at the top compared to a floor hip raise. Using a kettlebell is ideal for beginners and advanced athletes alike due to easy setup and load control.', setup_instructions_en = '1. Sit on the floor and rest your upper back (shoulder blades) against the edge of a bench.
2. Place a kettlebell on your pelvis and hold it with both hands for stability.
3. Place your feet flat on the ground at approximately shoulder-width.
4. Exhale and drive your hips upward until your body is in a straight line from shoulders to knees.
5. At the top position, squeeze your glutes hard, hold for a second, then inhale and slowly return just above the ground.'
WHERE id = '2076dbb0-e70d-485d-a75a-435e41cc0165'; -- Hip thrust s kettlebellem

UPDATE exercises SET
  name_en = 'Barbell Hip Thrust', description_en = 'The machine hip thrust is one of the best isolation exercises for maximum glute development. Compared to the free barbell version, the machine offers greater stability, safer hip fixation, and constant tension throughout the full range of motion. Thanks to the padded belt or support and the fixed movement path, it allows effective muscle engagement without pressure on the lumbar spine.', setup_instructions_en = '1. Sit in the machine and lean back against the padded support.
2. Fasten the safety belt or secure the padded lever across your pelvis.
3. Position your feet on the platform at approximately shoulder-width so that your knees form a 90-degree angle at the top.
4. Exhale and drive your hips upward; at the top, squeeze your glutes hard and hold for a second.
5. Inhale and slowly and in a controlled manner lower your hips, but do not let the weight rest completely.'
WHERE id = '9e67b7e5-ec13-439e-8fe4-c264a8cc3e39'; -- Hip thrust s osou

UPDATE exercises SET
  name_en = 'Sandbag Hip Thrust', description_en = '1. Sit on the floor with a bench behind you. Place the barbell across your legs just above your hips.
2. Lean back against the bench so it rests on your shoulders. Extend your arms to both sides as support on the bench.
3. Lift the weight by pushing through your feet and raising your hips upward. Support the weight with your shoulders and feet.
4. Slowly rise as high as you can, then slowly return to the starting position.', setup_instructions_en = 'Prepare a box or bench approximately 45-60 cm high and a pad under the bar. Sit next to the box and place the bar on your hips - slide down until your shoulder blades are on the edge of the box. Feet shoulder-width apart, toes forward. Do not place your feet too far forward (shortens range of motion) or too close (engages more quadriceps). Grip the bar overhand or with an alternating grip - hands just stabilize position. Retract your shoulder blades and brace them against the box.'
WHERE id = 'e4764cda-9490-4544-9ae3-64978c64381a'; -- Hip thrust s pytlem

UPDATE exercises SET
  name_en = 'Rack Hip Thrust', description_en = 'The barbell hip thrust in a rack (half rack) is one of the most effective exercises for isolated development of the glutes and hamstrings. Using the rack allows safe handling of a heavy barbell and precise adjustment of the safety stop height. This exercise builds explosive hip joint strength and contributes to better pelvic stability and posture.', setup_instructions_en = '1. Place a bench or box slightly behind the bar in the rack and set the safety stops to hip height when seated.
2. Sit on the floor, rest your shoulder blades on the edge of the bench, and position the bar over your hips (use bar padding).
3. Place your feet shoulder-width apart and brace your core.
4. Exhale and smoothly drive your hips upward until your torso is parallel to the ground.
5. At the top, squeeze your glutes hard, then inhale and slowly lower the bar back to the ground or safety stops.'
WHERE id = '2dadf15e-5fec-421f-a30e-27d3f9e5461a'; -- Hip thrust v rámu

UPDATE exercises SET
  name_en = 'Standing Hip Thrust', description_en = 'The standing hip thrust on a plate-loaded machine is an innovative variation of the classic hip thrust that allows the glutes to be trained at a unique angle. Thanks to a design that combines forward pelvic movement with a slight torso lean, there is extreme targeting of the upper glutes and deep hamstrings. The machine provides high stability and allows safe use of heavy loads without pressure on the hip bones.', setup_instructions_en = '1. Load the appropriate weight in the form of plates onto the machine pegs.
2. Stand on the platform and rest the upper part of your thighs/pelvis against the padded roller.
3. Grip the handles in front of you to ensure maximum torso stability.
4. Exhale and drive your hips forward with force against the padding until you achieve full hip extension and maximum glute contraction.
5. Inhale and return in a controlled manner, allowing your hips to drift slightly back into a stretch.'
WHERE id = 'e7db9ffb-f459-45fb-b5b1-483b3cb69b57'; -- Hip thrust vstoje

UPDATE exercises SET
  name_en = 'Horizontal Leg Press', description_en = 'The horizontal leg press is a fundamental machine for safe and effective lower limb muscle building. Compared to the classic 45-degree leg press, the horizontal variant offers a more natural movement path that puts less strain on the lumbar spine. The machine allows isolated work of the quadriceps, hamstrings, and glutes with the option of precise range of motion adjustment.', setup_instructions_en = '1. Adjust the seat distance so that your knees are at approximately a 90-degree angle in the starting position.
2. Sit down, press your entire back and lower back firmly against the support.
3. Place your feet on the platform at shoulder-width, toes can point slightly outward.
4. Exhale and smoothly press the platform forward to near full leg extension (do not lock your knees).
5. Inhale and return the weight in a controlled manner until your knees approach your chest without your lower back lifting off.'
WHERE id = 'fbb76fa9-6890-4740-b169-b737803f35a5'; -- Horizontální leg press

UPDATE exercises SET
  name_en = 'Hyperextension (Glute Focus)', description_en = 'This hyperextension variation is specifically adapted for maximum engagement of the gluteus maximus. Changing the back position and foot placement shifts the primary load from the spinal erectors directly to the glutes and posterior thighs. It is an excellent exercise for both building strength and shaping the buttocks without excessively overloading the lower back.', setup_instructions_en = '1. Set the support slightly lower than for a standard hyperextension to allow full range of motion at the hips.
2. Turn your feet on the footpads slightly outward (approximately 45 degrees).
3. Keep your upper back slightly rounded (''chin to chest''), which helps eliminate lower back engagement.
4. Inhale and lower in a controlled manner.
5. Exhale and rise primarily by pressing your pelvis into the support and squeezing your glutes hard.'
WHERE id = '31f59af0-e97a-4afc-a2b7-8c3e85c4f591'; -- Hyperextenze (zaměření na hýždě)

UPDATE exercises SET
  name_en = 'Hip Hyperextension', description_en = 'The Booty Builder machine allows hip extension exercises to be performed in a very stable position with the ability to smoothly add resistance. Unlike a standard hyperextension bench, the Booty Builder offers specific ergonomics that fix the body so the primary work is performed by the gluteus maximus and the posterior thighs, while lower back engagement is minimized.', setup_instructions_en = '1. Adjust the Booty Builder to the correct height so that the padding ends below your hips.
2. Place the front of your hips on the pad and firmly grip the handles.
3. Secure your ankles in the strap or brace them safely against the support.
4. Inhale and in a controlled manner hinge forward at the hips toward the ground, keeping your torso in a straight line.
5. Exhale and activate your glutes to press back to the starting position until your body is in a straight line.'
WHERE id = 'af75b3d7-86a2-4052-bd0c-a3223351bb72'; -- Hyperextenze kyčlí

UPDATE exercises SET
  name_en = 'Back Hyperextension', description_en = 'The back hyperextension is one of the most effective exercises for strengthening the spinal erectors and lower back muscles. This exercise helps stabilize the spine, improves posture, and serves as a prevention against back pain. Depending on the support position and technique, the exercise can also significantly target the gluteus maximus and posterior thighs.', setup_instructions_en = '1. Set the support height so its upper edge ends just below your hip bones (allowing a free forward lean).
2. Brace your feet against the footpads and rest your calves against the rollers.
3. Cross your arms over your chest or place them behind your head. Keep your back in a straight position.
4. Inhale and in a controlled manner hinge forward at the hips until you feel a slight stretch.
5. Exhale and smoothly rise back up until your body is in a straight line.'
WHERE id = '15e9a7e7-b952-43ff-9352-8f762d50ca0d'; -- Hyperextenze zad

UPDATE exercises SET
  name_en = 'Single-Arm Cable Rear Fly', description_en = 'The single-arm cable rear delt fly in a forward bend is a precise isolation exercise targeting the posterior head of the deltoid muscle. The deep forward lean and the low cable pull allow targeting the muscle at an angle that is difficult to achieve with dumbbells. Exercising one arm at a time helps improve mind-muscle connection and correct shoulder strength asymmetry.', setup_instructions_en = '1. Set the cable to the lowest position and use a single-handle attachment.
2. Stand sideways to the cable machine and bend forward so your torso is almost parallel to the ground.
3. Grip the handle with the far hand (crossing under your body). You can steady yourself with the other hand on your knee or the machine frame.
4. Exhale and smoothly raise your arm in an arc out to the side and upward until it is at shoulder level. Keep the elbow slightly bent.
5. At the top, hold for a second, then inhale and in a controlled manner return your hand back under the body to a slight stretch.'
WHERE id = '4551d6db-98f8-48cb-b4da-01abd1f1aa84'; -- Jednoruční zapažování na kladce v předklonu

UPDATE exercises SET
  name_en = 'Unilateral Leg Extension', description_en = '1. Sit on the machine so your back is pressed against the support. Set the machine so your knees are at a 90-degree angle in the starting position.
2. Lift the weight by extending the knee joint outward, then return the leg to the starting position. Perform both movements at a slow and controlled pace.', setup_instructions_en = 'Set up the machine the same way as for a bilateral leg extension. Place only one leg under the shin pad, keep the other leg free.'
WHERE id = 'f4e9fbb2-01f8-4adc-a119-77211988e7d5'; -- Jednostranná extenze nohou

UPDATE exercises SET
  name_en = 'Unilateral Cable Front Raise', description_en = 'The low cable front raise with an EZ bar adapter is an isolation exercise targeting the anterior deltoid. Using a cable ensures constant tension throughout the full range of motion, especially in the lower phase, unlike dumbbells. The EZ bar adapter allows a more natural grip, reducing wrist tension and enabling better control over the weight.', setup_instructions_en = '1. Set the cable to the lowest position and attach the EZ bar adapter.
2. Stand with your back to the cable machine, the cable running between your legs.
3. Grip the adapter with an overhand grip at shoulder-width.
4. Exhale and raise your extended arms (with a slight elbow bend) in front of you to eye level.
5. Inhale and in a controlled manner lower the adapter back to the starting position.'
WHERE id = '7c8003e4-c9ae-4aa0-91ca-34b14099aa52'; -- Jednostranné předpažení na kabelu

UPDATE exercises SET
  name_en = 'Unilateral Tricep Extension', description_en = '1. Set the cable to the highest position on the machine.
2. Keep your arm pressed against your body. Extend your forearm until you feel triceps contraction.', setup_instructions_en = 'Set the cable to the top position and attach a rope or bar attachment. Stand facing the machine and grip the attachment with one hand. Keep your elbow pressed against your body.'
WHERE id = 'cee17ca4-25ea-4275-81ea-5dde8a71e80c'; -- Jednostranné tricepsové natažení

UPDATE exercises SET
  name_en = 'Unilateral Tricep Extension', description_en = 'The single-arm triceps extension (kickback) is an isolation exercise aimed at developing and shaping the triceps. Performing the exercise one arm at a time allows better focus on muscle contraction and helps correct potential differences in strength and volume between the arms. The bench support provides body stability, minimizing the involvement of other muscle groups.', setup_instructions_en = '1. Rest one knee and the same-side hand on a flat bench, torso nearly parallel to the ground.
2. With the other hand, grip a dumbbell and press your upper arm against your body so it is horizontal.
3. Exhale and in a controlled manner extend your forearm backward until you feel maximum triceps contraction and the arm is fully extended.
4. At the top position, pause for a second, then inhale and slowly return to the starting position (forearm perpendicular to the ground).
5. After completing the set, switch arms.'
WHERE id = '1454fbd4-93d7-4b3e-a403-cf58453703d4'; -- Jednostranné tricepsové natažení

UPDATE exercises SET
  name_en = 'Unilateral Kettlebell Tricep Extension', description_en = 'This isolation exercise targets the long head of the triceps. Performing it with one arm holding a kettlebell requires greater shoulder stability and core activation to prevent torso lean. The unilateral variation helps identify and correct strength differences between the left and right arm.', setup_instructions_en = '1. Stand upright or sit on a bench with back support.
2. Grip a kettlebell with one hand and raise your arm directly overhead.
3. Keep your elbow close to your ear pointing forward or slightly toward the ceiling.
4. Inhale and slowly lower the kettlebell behind your head by bending at the elbow until you feel triceps stretch.
5. Exhale and in a controlled manner extend your arm back to the starting position overhead.'
WHERE id = '8ac29a53-5ab1-4414-9c13-61bf236e24e3'; -- Jednostranné tricepsové natažení s kettlebellem

UPDATE exercises SET
  name_en = 'Unilateral Cable Lateral Raise', description_en = 'The single-arm low cable lateral raise is an excellent isolation exercise for building shoulder width and emphasizing the medial deltoid head. The advantage of a cable over dumbbells is constant muscle tension throughout the full range of motion, especially in the lower phase where resistance from dumbbells is lacking. Performing one arm at a time allows better focus on muscle work and elimination of strength imbalances.', setup_instructions_en = '1. Set the cable to the lowest position and use a single-handle attachment.
2. Stand sideways to the machine, feet shoulder-width apart for stability.
3. Grip the handle with the far hand; the cable can pass in front of or behind your body.
4. Exhale and smoothly raise your arm out to the side to shoulder level (parallel to the ground).
5. Inhale and in a controlled manner lower the handle back to the starting position.'
WHERE id = '2933079e-6672-4a05-a4d9-c36899676fd3'; -- Jednostranné upažení na kabelu

UPDATE exercises SET
  name_en = 'Unilateral Dumbbell Hip Thrust', description_en = 'The single-leg dumbbell hip thrust is an advanced unilateral variation of the classic hip thrust. Exercising one leg at a time allows deeper targeting of the glute muscle and effectively corrects strength differences between the left and right sides. The instability created by working on one leg also massively engages the core to maintain a level pelvis.', setup_instructions_en = '1. Rest the lower part of your shoulder blades against the edge of a bench.
2. Place a dumbbell on the hip of the leg that will remain on the ground. Lift the other leg and hold it bent in the air.
3. Position the foot of the standing leg directly below the knee (at the top, the knee should be at a 90-degree angle).
4. Exhale and drive your hips upward until your torso is in line with the thigh of the standing leg.
5. At the top, squeeze the glute hard, hold for a second, then inhale and lower in a controlled manner just above the ground.'
WHERE id = '831fef20-291c-45b3-b994-ff862a0a2f2c'; -- Jednostranný hip thrust s jednoručkou

UPDATE exercises SET
  name_en = 'Unilateral Kettlebell Hip Thrust', description_en = 'The single-leg kettlebell hip thrust is an advanced unilateral exercise targeting glute and hamstring isolation. Performing it on one leg increases load intensity and places high demands on hip and core stability. It is the ideal tool for correcting strength differences between the right and left sides of the body and for improving overall pelvic stability.', setup_instructions_en = '1. Sit on the floor and rest your upper back (shoulder blades) against the edge of a bench.
2. Place a kettlebell on the hip of the working leg and hold it with your hand for stability.
3. Lift one leg off the ground (bent at the knee or extended), keeping the other firmly on the ground.
4. Exhale and drive your hips upward until your torso is in a straight line with the thigh of the working leg.
5. At the top, squeeze your glutes hard, then inhale and lower your hips in a controlled manner just above the ground.'
WHERE id = '5e6281d0-8cca-4aae-8440-f097131e1909'; -- Jednostranný hip thrust s kettlebellem

UPDATE exercises SET
  name_en = 'Unilateral Leg Curl', description_en = '1. Stand at the machine, brace one foot against the support, and position the working leg with the heel under the padded roller.
2. Grip the handles for stability and lean slightly forward, resting your chest against the padding.
3. Exhale and smoothly curl the heel toward your glutes using your hamstrings.
4. At the top, briefly squeeze the muscle, then inhale and in a controlled manner return the leg to the starting position.
5. After completing the set, switch legs.', setup_instructions_en = '1. Adjust the height of the padded roller so it rests on the lower part of your calf just above the heel.
2. Adjust the chest support and handles so the stance is stable and comfortable.'
WHERE id = 'b222a429-e5ba-42d4-8b40-c64a7c332f07'; -- Jednostranný leg curl

UPDATE exercises SET
  name_en = 'Unilateral Leg Curl', description_en = '1. Lie on the machine and place your legs under the padded lever. Position your legs so the lever is below the inner part of your calf.
2. Hold the side handles of the machine and slowly raise the weight with your legs, toes pointing forward.
3. Pause at the top position, then slowly return to the starting position.', setup_instructions_en = 'Adjust the shin pad just above the ankle of the working leg. Lie or sit on the machine, back against the support. The other leg is free.'
WHERE id = 'a3073a12-bded-41e3-ac80-82e7c0bf4bfa'; -- Jednostranný leg curl

UPDATE exercises SET
  name_en = 'Unilateral Dumbbell Row', description_en = 'The single-arm dumbbell row is a fundamental multi-joint exercise for developing the back muscles. The unilateral approach (one arm) allows a greater range of motion and better muscle stretch in the bottom phase. Bracing on the bench stabilizes the torso, allowing safe use of heavier weights and elimination of asymmetries between the left and right sides of the back.', setup_instructions_en = '1. Rest one knee and the same-side hand firmly on a flat bench. The other leg stands firmly on the ground.
2. The torso should be nearly parallel to the ground, back flat, head in line with the spine.
3. Grip the dumbbell with the free hand, arm fully extended in the bottom position (feeling a stretch in the shoulder blade).
4. Exhale and pull the dumbbell toward your hip (not toward your chest). Focus on pulling the elbow back and up.
5. At the top, squeeze the shoulder blade firmly toward the spine, hold for a second, then inhale and lower the dumbbell in a controlled manner.'
WHERE id = '34ec3d2c-dc1f-48a6-afeb-3fc4433499a3'; -- Jednostranný přítah s jednoručkou

UPDATE exercises SET
  name_en = 'Unilateral Kettlebell Row', description_en = 'The single-arm kettlebell row in a kneeling position is an effective strength exercise targeting the latissimus dorsi and inter-scapular muscles. The kneeling position with one-hand support directly on the ground provides stability and allows focused work of the back muscles without overloading the lower back. This variation is ideal for building symmetry and strength of the upper body.', setup_instructions_en = '1. Kneel on both knees on the ground. 2. Brace one hand firmly on the ground (or on another kettlebell for greater stability), so your torso is nearly parallel to the ground and your back remains flat. 3. Grip the kettlebell with the other hand, hanging freely toward the ground with an extended arm. 4. Exhale and pull the kettlebell upward toward your hip (side) and consciously draw your shoulder blade toward your spine. 5. Keep your elbow close to your body and pause briefly at the top. 6. Inhale and slowly and in a controlled manner lower the kettlebell back to the starting position.'
WHERE id = 'c8b4bbec-46b5-4138-866e-c4601c23cae5'; -- Jednostranný přítah s kettlebellem

UPDATE exercises SET
  name_en = 'Unilateral Romanian Deadlift on Slider', description_en = '1. Stand shoulder-width apart. Push your hips back and keep your knees nearly locked out.
2. You should feel a stretch in the back of your thighs. Once you feel the stretch, drive your hips forward to return to the starting position.
3. Do not drive your hips all the way forward so you don''t hyperextend your spine. Only go to a normal standing position.', setup_instructions_en = 'Stand upright. Place a sliding disc under one foot. Weight on the front foot. Keep your back flat and hold the other hand free or on a support.'
WHERE id = 'c7fdaed0-0e63-47af-ba46-e83f614017d7'; -- Jednostranný rumunský mrtvý tah na klouzačce

UPDATE exercises SET
  name_en = 'Unilateral Dumbbell Romanian Deadlift', description_en = 'The single-leg Romanian deadlift is a challenging unilateral exercise that effectively isolates the hamstrings and glutes. Balancing on one leg results in significant activation of the deep stabilizing system and improvement of overall balance. It is ideal for correcting muscular imbalances and strengthening the functional stability of the pelvis and lower limbs.', setup_instructions_en = '1. Stand on one leg, holding a dumbbell in the opposite hand (if standing on the right, the dumbbell is in the left). You may use the other hand for balance.
2. Brace your core and draw your shoulders back and down.
3. Inhale and begin to hinge in a controlled manner at the hip of the standing leg, while the free leg extends backward.
4. Lower the dumbbell close along the standing leg until you feel a strong stretch in the hamstring. Keep your back flat.
5. Exhale and drive through the heel and squeeze the glute to return to an upright position.'
WHERE id = 'a352c424-3a9e-486f-acbc-a8784457cc7c'; -- Jednostranný rumunský mrtvý tah s jednoručkou

UPDATE exercises SET
  name_en = 'Unilateral Kettlebell Romanian Deadlift', description_en = 'The single-leg Romanian deadlift with a kettlebell is an excellent unilateral exercise for developing strength of the posterior chain, glutes, and deep stabilizing system. Performing it on one leg increases demands on balance and ankle and hip stability, while helping to correct strength imbalances between the right and left sides of the body.', setup_instructions_en = '1. Stand upright and grip a kettlebell in one hand. 2. Shift your weight onto the leg on the opposite side from the hand holding the kettlebell (contralateral position for better stability). 3. Inhale and with a slightly bent knee on the standing leg, slowly hinge your torso forward while simultaneously extending the free leg behind you. 4. Lower the kettlebell close along the standing leg until your torso and the extended rear leg are nearly parallel to the ground. 5. Exhale and drive through the heel and activate the glutes to return to an upright position.'
WHERE id = 'ad358d90-c115-4310-b179-cdb223f5047b'; -- Jednostranný rumunský mrtvý tah s kettlebellem

UPDATE exercises SET
  name_en = 'Cycling', description_en = 'Stationary bike riding is a highly effective cardiovascular workout with low joint impact. This exercise strengthens the lower limb muscles, improves endurance, and is ideal for burning fat or warming up before strength training. The smooth rotational movement ensures constant engagement of the quadriceps and hamstrings.', setup_instructions_en = '1. Adjust the seat height so that the knee is slightly bent at the bottom of the pedal stroke.
2. Sit down, grip the handlebars, and maintain a neutral spine position.
3. Secure your feet in the pedals (if straps are available).
4. Pedal at a smooth pace and minimize torso swaying from side to side.
5. Keep a slightly forward-leaning back and breathe rhythmically.'
WHERE id = 'a8fdbb25-4da9-4cd5-9be5-d7921475a91d'; -- Jízda na kole

UPDATE exercises SET
  name_en = 'Cable Kickback', description_en = 'The cable kickback (also known as cable glute kickback) is one of the best isolation exercises for activating and shaping the gluteus maximus. Unlike bodyweight or resistance band variations, the low cable provides constant tension throughout the full range of motion. The exercise allows maximum muscle engagement and is ideal for correcting muscular imbalances between the right and left sides.', setup_instructions_en = '1. Set the cable to the lowest position and attach an ankle strap to the working leg.
2. Stand facing the machine, lean slightly forward, and hold the frame for stability.
3. Slightly bend the standing leg. Exhale and smoothly kick the working leg directly back until you feel a strong glute contraction.
4. At the top position, pause for a second, then inhale and in a controlled manner return the leg to the starting position.
5. After completing the set, switch legs.'
WHERE id = 'e8863e63-4ed5-4291-b36b-1cea09e4b471'; -- Kickback na kabelu

UPDATE exercises SET
  name_en = 'Machine Kickback', description_en = '1. Attach a special ankle attachment. Set the cable to the bottom part of the machine.
2. Bend at the knee, push your heel back and simultaneously extend at the hip.
3. At the moment you feel glute contraction, hold for one count.
4. Then return to the starting position by flexing at the hip.', setup_instructions_en = '1. Set up the machine for the glute kickback.
2. Grip the handles for support.
3. Place the working leg on the platform or under the pad.
4. Back flat, slight forward lean.'
WHERE id = '4f470eb3-bbb2-4b8e-9be4-83ad2f1af666'; -- Kickback na stroji

UPDATE exercises SET
  name_en = 'Dumbbell Hammer Curl', description_en = 'The hammer curl is an effective biceps curl variation that, thanks to a neutral grip (palms facing each other), places greater emphasis on the brachialis and forearm muscles. This exercise is key for building overall arm thickness and grip strength. It helps create a balanced arm appearance and reduces wrist tension that can occur with classic supinated curls.', setup_instructions_en = '1. Stand upright holding dumbbells in extended arms at your sides.
2. Palms face your torso and maintain this ''neutral'' grip throughout the movement.
3. Brace your core and fix your elbows close to your hips.
4. Exhale and in a controlled manner curl the dumbbells toward your shoulders without rotating the wrists.
5. At the top, squeeze the biceps and forearms hard, then inhale and slowly lower to the starting position.'
WHERE id = '3a7225eb-8349-4d41-bd6f-5a40787cffe7'; -- Kladivový zdvih s jednoručkami

UPDATE exercises SET
  name_en = 'Kettlebell Hammer Curl', description_en = 'The kettlebell hammer curl is a biceps curl variation that, thanks to the neutral grip, more intensely engages the brachialis and brachioradialis muscles. Using kettlebells shifts the center of gravity of the load, placing greater demands on wrist stability and grip strength. The exercise is ideal for building comprehensive arm strength and volume.', setup_instructions_en = '1. Stand upright with a kettlebell in each hand.
2. Let your arms hang at your sides in a neutral grip (thumbs pointing forward).
3. Exhale and in a controlled manner curl the kettlebells toward your shoulders, keeping your elbows fixed at your sides.
4. At the top, squeeze the biceps hard and pause the movement for a second.
5. Inhale and slowly lower the kettlebells back to the starting position.'
WHERE id = '03aca4de-3380-43df-a23b-7256a7381ab5'; -- Kladivový zdvih s kettlebellem

UPDATE exercises SET
  name_en = 'Parallel Bar Dips', description_en = 'Parallel bar dips are one of the most effective exercises for building a massive upper body. The exercise uses bodyweight to intensely load the pectoral muscles and triceps. By varying the lean of the body, you can easily shift the emphasis between the chest and arms, making dips a versatile tool for both functional strength and volume.', setup_instructions_en = '1. Jump into a support position on the parallel bars, extend your arms, and actively press your shoulders down away from your ears.
2. Inhale and lower in a controlled manner until your elbows form approximately a 90-degree angle.
3. Keep your elbows close to your body (for triceps) or slightly flared outward (for chest).
4. Exhale and press back up to the starting position using your chest and triceps.
5. At the top, maximally squeeze the muscles for a moment, but do not lock out your elbows with impact.'
WHERE id = '9a1273fb-6d4d-4488-bd32-104ad0fc1aca'; -- Kliky na bradlech

UPDATE exercises SET
  name_en = 'Machine Bar Dips', description_en = 'A plate-loaded dip machine with a dual-arm system. This machine simulates the movement of classic parallel bar dips, but with the advantage of a fixed movement path and back support. The independent arms (dual system) ensure even loading of both sides of the body and eliminate muscular imbalances. It is an excellent exercise for safe force overload of the lower pectoral muscles and triceps.', setup_instructions_en = '1. Load the appropriate number of plates onto the machine pegs.
2. Adjust the seat height so the handles are at hip level or slightly above.
3. Sit down, press firmly against the back support, and brace your feet on the floor or foot supports.
4. Grip the handles and exhale while driving them downward using your chest and triceps strength.
5. At the bottom position, do not fully lock out your arms - keep the muscles under tension.
6. Inhale and slowly and in a controlled manner return the handles to the starting position upward.'
WHERE id = '9b58a377-f4ed-4a00-93dd-37d539f6a4d4'; -- Kliky na bradlech na stroji

UPDATE exercises SET
  name_en = 'Cable Crossover', description_en = '1. Grip the bar with palms facing forward, hands wider than shoulder-width.
2. With extended arms in front holding the bar, lean your torso back approximately 30 degrees and chest up.
3. Pull the bar in a smooth movement down to chin level or slightly below, simultaneously squeezing your shoulder blades together.
4. After a brief squeeze, slowly return the bar to the starting position with extended arms.', setup_instructions_en = '1. Adjust the thigh pad to a height that allows you to fully insert your legs under it while keeping you firmly in the seat.
2. Grip the bar with an overhand grip just at the curved part - you can use a thumbs-around or thumbs-over grip.
3. Hold the bar firmly, sit straight down, and slide your legs under the pad.'
WHERE id = '8ee63401-e247-4920-a1d4-fac18979924f'; -- Kruhové stahování

UPDATE exercises SET
  name_en = 'Dumbbell Shrugs', description_en = 'Dumbbell shoulder shrugs are an isolation exercise targeting the upper trapezius muscle. Strong trapezius muscles are important for shoulder stability, correct posture, and overall upper torso strength. Using dumbbells allows a more natural range of motion and better control than barbell shrugs, as the arms can remain in a neutral position at the sides.', setup_instructions_en = '1. Stand upright with feet shoulder-width apart.
2. Hold dumbbells in both hands at your sides, palms facing your torso.
3. Maintain a slightly braced core and neutral head position (looking straight ahead).
4. Exhale and raise your shoulders as high as possible toward your ears using the trapezius alone. Arms remain extended.
5. At the top, squeeze the muscles for a second, then inhale and in a controlled manner lower your shoulders back to the starting position.'
WHERE id = '07b19d10-e434-4093-a32f-0b8a799c3937'; -- Krčení ramen s jednoručkami

UPDATE exercises SET
  name_en = 'Kettlebell Shrugs', description_en = 'The kettlebell shoulder shrug is a basic isolation exercise targeting the upper trapezius muscles. Using kettlebells provides a natural movement path along the body and helps improve grip strength and overall shoulder and cervical spine stability.', setup_instructions_en = '1. Pick up two kettlebells and stand upright with a narrow stance.
2. Hold the kettlebells at your sides with extended arms in a neutral grip.
3. Exhale and in a controlled manner pull your shoulder blades (shoulders) up toward your ears.
4. At the top position, pause for a second and squeeze the trapezius hard.
5. Inhale and slowly and in a controlled manner lower your shoulders back to the starting position.'
WHERE id = '7012c28d-806c-4159-8847-eaf1e4c4068e'; -- Krčení ramen s kettlebellem

UPDATE exercises SET
  name_en = 'Lat Pulldown', description_en = '1. Grip the bar with an overhand grip, hands wider than shoulder-width.
2. Lean slightly back (approximately 30 degrees), chest up, gaze slightly upward.
3. In a smooth movement, pull the bar down to the upper chest while consciously pressing your shoulder blades together.
4. At the bottom position, briefly pause and then in a controlled manner return the bar to extended arms.', setup_instructions_en = '1. Adjust the thigh pad height so it firmly holds you in the seat with your feet on the ground.
2. Select an appropriate weight and sit with an upright back.'
WHERE id = '90f7cf94-99ce-4067-a97f-f1f3d07c17b5'; -- Lat Pulldown

UPDATE exercises SET
  name_en = '45° Leg Press', description_en = '1. Place your feet on the platform at shoulder-width.
2. Release the weight and fully extend your legs without locking your knees.
3. Lower the weight until your legs are at a 90-degree angle (but DO NOT allow your glutes and lower back to lift off the pad - rounding your lower back is very dangerous).
4. Press the weight back to the starting position.', setup_instructions_en = '1. Sit in the leg press with your entire back against the support.
2. Place your feet on the platform shoulder-width apart, toes slightly out.
3. Unlock the safety stops.'
WHERE id = '2fa9fb84-9d25-4f08-82e2-ea723397e759'; -- Leg press 45°

UPDATE exercises SET
  name_en = '45° Leg Press', description_en = '1. Place your feet on the platform at shoulder-width.
2. Release the weight and fully extend your legs without locking your knees.
3. Lower the weight until your legs are at a 90-degree angle (but DO NOT allow your glutes and lower back to lift off the pad - rounding your lower back is very dangerous).
4. Press the weight back to the starting position.', setup_instructions_en = '1. Sit in the leg press with your entire back against the support.
2. Place your feet on the platform shoulder-width apart, toes slightly out.
3. Unlock the safety stops.'
WHERE id = 'ab668e56-0e98-488f-a429-e6ffccf7c4f7'; -- Leg press 45°

UPDATE exercises SET
  name_en = '45° Leg Press', description_en = '1. Place your feet on the platform at shoulder-width.
2. Release the weight and fully extend your legs without locking your knees.
3. Lower the weight until your legs are at a 90-degree angle (but DO NOT allow your glutes and lower back to lift off the pad - rounding your lower back is very dangerous).
4. Press the weight back to the starting position.', setup_instructions_en = '1. Sit in the leg press with your entire back against the support.
2. Place your feet on the platform shoulder-width apart, toes slightly out.
3. Unlock the safety stops.'
WHERE id = 'f1bcfaaf-ce8d-416a-83b1-49ad1ac306f8'; -- Leg press 45°

UPDATE exercises SET
  name_en = 'Scapular Retraction', description_en = '1. From a standing or seated position, straighten your back.
2. Pull your shoulders back but keep them relaxed.
3. Move your shoulders back and return to the starting relaxed position.', setup_instructions_en = 'Stand or hang from a bar with extended arms. Relax your shoulders. Focus exclusively on the movement of the shoulder blades - without arm movement.'
WHERE id = '8e9fcbd2-cacb-40ad-8705-919a8495c689'; -- Lopatka

UPDATE exercises SET
  name_en = 'Bear Walk', description_en = 'I assume a position on all fours. Knees are under my hips, palms under my shoulders. I brace onto my toes so that my knees lift just slightly off the ground. When walking, my limbs move in a cross-pattern (left hand, right foot).', setup_instructions_en = 'Kneel on all fours - palms under shoulders, knees under hips. Lift your knees approximately 5 cm off the floor. Back flat, parallel to the ground.'
WHERE id = '0734228e-60a2-48c7-8d86-c806525b7309'; -- Medvědí chůze

UPDATE exercises SET
  name_en = 'Bear Plank', description_en = 'I assume a position on all fours. Knees are under my hips, palms under my shoulders. I brace onto my toes so that my knees lift just slightly off the ground.', setup_instructions_en = 'Kneel on all fours - palms under shoulders, knees under hips. Lift your knees approximately 5 cm off the floor and hold statically. Back flat.'
WHERE id = '5c095e98-644f-4f2d-a023-f0debe35a104'; -- Medvědí plank

UPDATE exercises SET
  name_en = 'Dead Bug', description_en = '1. Lie on your back, arms extended upward, legs raised with knees bent.
2. Lower the opposite arm and leg toward the ground, keeping your back pressed against the mat.
3. Alternate sides, maintaining core tension, and repeat for the required number of repetitions or duration.', setup_instructions_en = 'Lie on your back on a mat. Raise your arms perpendicular to the ceiling and bend your legs to 90° (shins parallel to the ground). Press your lower back into the mat.'
WHERE id = 'f64cc8ba-437f-4234-acf1-6231979d14ba'; -- Mrtvý brouk

UPDATE exercises SET
  name_en = 'Deadlift on Platform', description_en = '1. Stand so the middle of your foot is under the bar and grip it at shoulder-width.
2. Bend your knees, then lift the bar by straightening your back. It is important to keep your back flat.
3. Stand to full height and hold the bar.
4. Return the bar to the ground by bending your knees and keeping your back flat.', setup_instructions_en = 'Stand on the platform with the bar in front of your feet. Stance at shoulder-width, grip the bar overhand or with alternating grip. Back flat, hips above knees.'
WHERE id = 'c65a3d41-cd7c-4b30-b4df-728a619cb4bc'; -- Mrtvý tah na plošině

UPDATE exercises SET
  name_en = 'Trap Bar Deadlift on Platform', description_en = '1. Stand with the center of your foot under the bar and grip it at shoulder-width.
2. Bend your knees, then lift the bar by straightening your back. It is important to keep your back flat.
3. Stand to full height and hold the position.
4. Lower the bar to the floor by bending your knees and with a flat back.', setup_instructions_en = 'Stand in the center of the trap bar on the platform. Grip the side handles, feet shoulder-width apart. Back flat, hips above knees.'
WHERE id = '15a4921e-a9b5-45da-b466-6beaa0630082'; -- Mrtvý tah trapbarem na plošině

UPDATE exercises SET
  name_en = 'Hanging Leg Raises to Bar', description_en = '1. Grip the bar and hang with the body still and legs extended.
2. Slowly pull your knees toward your chest.
3. Once you raise your knees as high as possible, lower your legs and repeat. Perform the movements slowly to avoid using momentum and make the exercise more effective.
4. Perform the movements slowly to avoid using momentum and make the exercise more effective.', setup_instructions_en = 'Grip the bar overhand at shoulder-width or slightly wider. Hang in a dead hang with arms fully extended. Slight back arch, body stabilized.'
WHERE id = 'a145b040-1566-4aa5-82f2-44c9e9b3cd32'; -- Nožky k tyči

UPDATE exercises SET
  name_en = 'Reverse Machine Fly', description_en = '1. Sit facing the machine backrest, press your chest firmly against it, and grip the handles (palms can face each other or downward).
2. Exhale and pull the handles in an arc rearward until your arms are in line with your shoulders.
3. At the end position, pause briefly and consciously squeeze the rear deltoids and inter-scapular muscles.
4. Inhale and in a controlled manner return to the starting position, but do not let the weight drop completely so the muscles remain under tension.', setup_instructions_en = '1. Set the machine arms to the furthest back position so the handles are in front of you.
2. Adjust the seat height so that your arms are horizontal at floor level and aligned with your shoulders during the movement.'
WHERE id = 'b4d141f9-8616-4287-bb13-741116b394ed'; -- Obrácené rozpažování na stroji

UPDATE exercises SET
  name_en = 'Elliptical Trainer', description_en = '1. Stand on the elliptical trainer pedals, hold the handles, and start moving your legs in a circular motion as if riding a bike.
2. The pedals move independently in an elliptical path, so you feel a natural stride without sharp knee stress.
3. The handles can move together with your legs or you can hold them statically for greater stability.
4. Maintain an upright body position, lean slightly forward, and breathe regularly - a proper rhythm will help with endurance and training efficiency.', setup_instructions_en = 'Stand on the elliptical trainer pedals and grip the handles. Set the resistance according to training intensity. Back upright, movement smooth.'
WHERE id = 'eab6fb58-4fe9-4929-bedd-d65d53c15e2c'; -- Orbitrek

UPDATE exercises SET
  name_en = 'Panatta Rowing Machine', description_en = '1. Sit with your back straight on the machine and grip the handles.
2. Pull the handles back with your hands. Your legs and torso should form a 90-degree angle. Chest up and forward.
3. Pull the handles to your body until your hands are beside your abdomen.', setup_instructions_en = 'Sit on the Panatta rowing machine. Adjust the foot support and seat height. Grip the handles, back upright, lean slightly forward.'
WHERE id = '646d7474-c83e-49c1-bde3-f764763ab9ae'; -- Panatta rowing stroj

UPDATE exercises SET
  name_en = 'Pec Deck', description_en = '1. Sit on the machine with your back and head firmly against the support.
2. Grip the handles with elbows slightly bent at shoulder level.
3. Exhale and in a smooth movement press the handles together in front of your chest until they almost touch.
4. At the moment of maximum pectoral contraction, squeeze the chest muscles, then inhale and in a controlled manner return to the starting position until you feel a slight stretch in the chest.', setup_instructions_en = '1. Adjust the seat height so the handles and your elbows are at the same level as the center of your chest.
2. Adjust the machine arm range so the starting position does not cause painful shoulder stretch.'
WHERE id = 'cc72d2f1-b4ad-40b8-a769-cee8e2072a05'; -- Peck deck

UPDATE exercises SET
  name_en = 'Pendlay Row', description_en = '1. Grip the bar with an overhand grip at shoulder-width, palms facing down or up.
2. Hinge at the hips with an upright back.
3. Pull the bar to the upper abdomen.
4. Slowly lower the bar and repeat.', setup_instructions_en = 'Place the bar on the floor. Stand over the bar, feet shoulder-width apart. Hinge forward so your torso is nearly parallel to the ground. Grip overhand at shoulder-width.'
WHERE id = 'f57c9283-7bdd-4ca4-b801-a4aea346dc67'; -- Pendlay row

UPDATE exercises SET
  name_en = 'Plank to Downward Dog', description_en = 'Start in a push-up plank position. Raise your hips upward and press your chest toward your feet until you reach a downward dog position. Then return to plank and repeat. Perform the movement smoothly and maintain an active core throughout all repetitions. Remember to keep your hands evenly spread and your head in a neutral position.', setup_instructions_en = 'Start in a full plank on extended arms - palms under shoulders, body in a straight line from head to heels. Back flat, core engaged.'
WHERE id = 'dca3531e-0b34-49cf-908b-4b24827d6571'; -- Plank do downward dog

UPDATE exercises SET
  name_en = 'Power Squat', description_en = 'The plate-loaded power squat machine is an excellent alternative to the classic barbell back squat. The machine stabilizes the movement path and fixes the back, reducing load on the lumbar spine and allowing safe overloading of the quadriceps and glutes. Thanks to the inclined platform, you can work at high intensity while maintaining maximum control over each repetition.', setup_instructions_en = '1. Load the appropriate number of plates onto the machine pegs.
2. Step into the machine, rest your back against the padding, and place your shoulders under the supports.
3. Place your feet on the platform at approximately shoulder-width.
4. Unlock the safety latch and inhale while slowly descending into a squat (knees pointing in the direction of your toes).
5. Exhale and drive smoothly back up through your heels, but do not fully lock out your knees at the top.'
WHERE id = '1c047b9a-5c12-46a5-9543-23367e72d43e'; -- Power squat

UPDATE exercises SET
  name_en = 'Hip Flexor Stretch', description_en = 'Step forward into a lunge with one foot, bend the back knee and rest it on the floor. Keep the upper body upright and gradually shift weight forward until you feel a stretch in the front of the hip and groin of the back leg. Hold for 20-30 seconds, then switch sides. It is important to keep the front knee directly above the ankle and not to tilt sideways - the stretch should be felt in the front of the thigh, not in the knee.', setup_instructions_en = 'Kneel on one knee, the other foot forward with the knee over the ankle. Maintain an upright torso, place hands on the front thigh or hips.'
WHERE id = '89f46e75-8c5f-4522-9ad9-6f5ac21d8a7d'; -- Protažení flexorů kyčle

UPDATE exercises SET
  name_en = 'Chest Stretch', description_en = 'Brace a forearm against a support point. Pull the shoulder back and down. Push the chest forward and outward.', setup_instructions_en = 'Stand or sit upright. Interlace fingers behind the back or grip a fixed object behind you. Draw the shoulders down and back.'
WHERE id = '87b63d8b-9b92-465d-aa58-a50e05270988'; -- Protažení hrudníku

UPDATE exercises SET
  name_en = 'Glute Stretch', description_en = 'Sit on the floor, extend one leg, bend the other and cross it over the extended leg so the knee points to the side. Place the opposite hand behind you for support and gently press the bent leg''s knee toward your body with the front hand. Hold for 20-30 seconds, then repeat on the other side.

Do not round the back and try to stay upright so the stretch is felt directly in the glutes. Do not force the leg down by pushing - it should be only a mild, pleasant pull without pain.', setup_instructions_en = 'Sit or lie on a mat. Bend both knees, cross one leg over the other - ankle on knee. Keep the back straight.'
WHERE id = '09c6a46f-07a0-4e54-891d-00c455f57cef'; -- Protažení hýždí

UPDATE exercises SET
  name_en = 'Neck Stretch', description_en = 'Stand or sit with a straight back. Slowly tilt the head toward one shoulder and hold it there with gentle hand pressure. Maintain the position for 20-30 seconds and feel the stretch on the side of the neck. Repeat on the other side and also perform forward tilts and chin tucks. It is important to avoid tilting the head backward, which shifts load onto the cervical spine - stretch only with soft movements and without pain.', setup_instructions_en = 'Sit or stand upright with relaxed shoulders. Head in the center, chin slightly down. Perform movements slowly and in a controlled manner.'
WHERE id = 'dcb880c4-f99b-4b0a-8c4a-1dea0ad8a4e9'; -- Protažení krku

UPDATE exercises SET
  name_en = 'Calf Stretch', description_en = 'Stand facing a wall or a support at about half a meter distance. Extend the back leg rearward and slightly bend the front leg. Both heels remain on the floor and hips face forward. The front leg is bent, and the calf of the back leg should feel tension. Be careful that the heel of the back foot does not rise - you should feel a pleasant stretch, not pain. For a more intense effect, move the back foot further away or slightly bend it.', setup_instructions_en = 'Stand facing a wall, about half a meter from it. One foot forward, the other back with the knee extended and heel on the floor. Place palms against the wall.'
WHERE id = 'c6323513-3016-443c-a611-98a189314480'; -- Protažení lýtek

UPDATE exercises SET
  name_en = 'Hamstring Stretch', description_en = 'Stand upright, place one leg on an elevated surface (bench, step) so the leg is at hip level. The other leg remains extended. Slowly bend forward toward the extended leg until you feel a stretch in the back of the thigh. Hold for 20-30 seconds, then repeat on the other side. Keep your back straight and do not bend only at the spine - the stretch should come from the hips. Do not bounce or swing; perform the movement smoothly and in a controlled manner.', setup_instructions_en = 'Stand or sit. Extend one leg in front of you, bend the other. Keep the back straight and hinge forward at the hips - not at the lower back.'
WHERE id = '0051d173-5e8f-4df3-a520-258fc436d780'; -- Protažení zadní strany stehna

UPDATE exercises SET
  name_en = 'Pullover', description_en = '1. Pick up a single dumbbell and hold it with both hands. Point the dumbbell toward the ceiling.
2. Flex at the shoulder joint with elbows mostly extended.
3. Flex until you feel a stretch in the lats, then return the dumbbell to the starting position.', setup_instructions_en = 'Lie across a bench or lengthwise on your back. Hold a dumbbell or barbell with both hands above the chest with elbows slightly bent.'
WHERE id = '368e6b5d-08c3-4b47-a589-50b06e1c740d'; -- Pullover

UPDATE exercises SET
  name_en = 'Seated Leg Extension', description_en = '1. Sit on the machine, rest your back against the support, and hook your shins behind the padded roller.
2. Grip the side handles to stabilize your torso and keep your hips in the seat.
3. Exhale and smoothly extend your legs at the knees to full extension.
4. At the top position, briefly squeeze the quadriceps, then inhale and in a controlled manner return your legs to the starting position.', setup_instructions_en = '1. Adjust the back support so your knees are directly in line with the machine''s pivot axis.
2. Set the roller to a position just above the ankles so it does not slide toward the feet during movement.'
WHERE id = '86c5962c-9917-4ee0-a36e-08cc74b0c642'; -- Předkopávání v sedě

UPDATE exercises SET
  name_en = 'Seated Leg Extension', description_en = '1. Sit on the machine, rest your back against the support, and hook your shins behind the padded roller.
2. Grip the side handles to stabilize your torso and keep your hips in the seat.
3. Exhale and smoothly extend your legs at the knees to full extension.
4. At the top position, briefly squeeze the quadriceps, then inhale and in a controlled manner return your legs to the starting position.', setup_instructions_en = '1. Adjust the back support so your knees are directly in line with the machine''s pivot axis.
2. Set the roller to a position just above the ankles so it does not slide toward the feet during movement.'
WHERE id = 'cac73ed1-6d3f-471f-bb09-212149ca4e11'; -- Předkopávání v sedě

UPDATE exercises SET
  name_en = 'Dumbbell Front Raise', description_en = 'The dumbbell front raise is an isolation exercise primarily targeting the anterior deltoid. It helps build shoulder definition and the upper body strength needed for pressing movements. Exercising with dumbbells allows correcting muscular imbalances between left and right and offers variability in grip (overhand or neutral).', setup_instructions_en = '1. Stand upright with feet shoulder-width apart, holding dumbbells in extended arms in front of your thighs.
2. Palms face your body (overhand grip) or each other (neutral grip).
3. With slightly bent elbows and a braced core, exhale and smoothly raise the dumbbells in front of you.
4. Stop the movement when your arms are parallel to the ground (at shoulder level).
5. Inhale and in a controlled manner lower the dumbbells back to the starting position.'
WHERE id = '933d064b-9235-4db8-9f0e-f36db9e2eb70'; -- Předpažení s jednoručkami

UPDATE exercises SET
  name_en = 'Kettlebell Front Raise', description_en = 'The kettlebell front raise is an isolation exercise targeting the anterior deltoid (front shoulder). It is performed by lifting the kettlebell from hip level to eye level, helping to build shoulder stability and upper body strength.', setup_instructions_en = '1. Stand upright with feet shoulder-width apart.
2. Grip the kettlebell with both hands by the handle and hold it in front of your hips.
3. Palms face each other or thumbs point forward.
4. Exhale and in a controlled manner raise the kettlebell slightly above head level.
5. At the top, pause the movement for a second.
6. Inhale and slowly return your arms to the starting position.'
WHERE id = '830949b8-e0a5-49f5-aff6-e9c5f12974ed'; -- Předpažení s kettlebellem

UPDATE exercises SET
  name_en = 'Low Cable Front Raise', description_en = 'The low cable front raise with an EZ bar adapter is an isolation exercise targeting the anterior deltoid. Using a cable ensures constant tension throughout the full range of motion, especially in the lower phase, unlike dumbbells. The EZ bar adapter allows a more natural grip, reducing wrist tension and enabling better weight control.', setup_instructions_en = '1. Set the cable to the lowest position and attach the EZ bar adapter.
2. Stand with your back to the cable machine, the cable running between your legs.
3. Grip the adapter with an overhand grip at shoulder-width.
4. Exhale and raise your extended arms (with a slight elbow bend) in front of you to eye level.
5. Inhale and in a controlled manner lower the adapter back to the starting position.'
WHERE id = 'b33f46f2-209c-435a-8b18-fa005ec59df4'; -- Předpažování na spodní kladce

UPDATE exercises SET
  name_en = 'Tire Flip', description_en = 'Stand facing the tire, grip it from the inside with both hands, and forcefully flip it over the edge toward you. Strongly engage your abdominal muscles and legs with each flip. Repeat at a rapid pace for the designated time.

Remember that the force should come primarily from your legs and core, not just your arms. Maintain a stable stance and breathe evenly - do not hold your breath.', setup_instructions_en = 'Stand facing the tire in a stable wide stance. Bend your knees and slide your hands under the bottom edge of the tire. Back flat, chest close to the tire.'
WHERE id = '871c33c7-63dc-432c-a329-772056317e12'; -- Překlopení pneumatiky

UPDATE exercises SET
  name_en = 'Pull-up', description_en = '1. Stand in front of a flat bench, feet shoulder-width apart, dumbbell in one hand.
2. Place the other hand on the bench as support and lean forward - chest parallel to the ground.
3. Pull the dumbbell to your chest and squeeze your shoulder blade.
4. Keep your elbow close to your body, core braced throughout.', setup_instructions_en = 'Select the weight by inserting the pin between the plates. You can use the bottom pedal to press the block closer.'
WHERE id = '0cccc8a1-5566-4018-a305-52cdc42f7c71'; -- Přítah

UPDATE exercises SET
  name_en = 'Knee to Chest Pull', description_en = '1. Lie on your back, hands at your sides or behind your head.
2. Flex your spine to curl your upper back off the floor and pull your knees toward your chest.', setup_instructions_en = 'Lie on your back on a mat. Legs bent or extended. Hands at your sides or behind your head. Lightly press your lower back into the mat.'
WHERE id = 'd5388cdd-5665-432b-b585-404e887e0b6b'; -- Přítah kolen k hrudníku

UPDATE exercises SET
  name_en = 'Seated Cable Row', description_en = '1. Sit on the machine, brace your feet against the supports, and grip the attachment.
2. Exhale and pull the attachment to your waist, keeping your elbows close to your body and squeezing your shoulder blades together.
3. At the end position, pause for a second and maximally contract your back muscles.
4. Inhale and in a controlled manner return your arms to the starting position without excessive forward lean at the lower back.', setup_instructions_en = '1. Select an appropriate attachment (e.g., a narrow V-handle) and set the appropriate weight.
2. Sit with slightly bent knees and straighten your back.'
WHERE id = 'd5db0f7c-218a-4b76-97db-42fda2a65daf'; -- Přítah na kabelu vsedě

UPDATE exercises SET
  name_en = 'Bench Kettlebell Row', description_en = 'This exercise focuses on activating the lower scapular stabilizers and posterior deltoids. Bracing the chest against the bench ensures strict technique by eliminating torso momentum. The Y-shaped movement path optimally engages the muscles responsible for proper scapular positioning and healthy shoulder joint mechanics.', setup_instructions_en = '1. Set the bench to approximately a 30-45 degree incline and lie face-down on it.
2. Hold a light dumbbell (kettlebell) in each hand, letting them hang perpendicular to the ground, palms facing each other (thumbs up).
3. Exhale and raise your extended arms diagonally forward so that your body and arms form the letter ''Y'' when viewed from above.
4. At the top, when your arms are in line with your torso, pause for a second and consciously press your shoulder blades downward.
5. Inhale and slowly lower the dumbbells back to the starting position.'
WHERE id = '1ea8d202-6c75-4bd0-8d79-cdc28b9634ea'; -- Přítah na lavičce s kettlebellem

UPDATE exercises SET
  name_en = 'Assisted Machine Pull-up', description_en = '1. Set the assistance weight. Stand on the platform, grip the handles wider than shoulder-width. Place your knees on the pad if available.
2. Slowly pull yourself up until your chin is above the bar. Keep your elbows close to your body, back muscles engaged.
3. Lower in a controlled manner. Pause at the bottom position. Repeat for the required number of repetitions.', setup_instructions_en = 'Set the assistance weight. Kneel or stand on the platform. Grip the bar overhand or underhand at shoulder-width.'
WHERE id = '6bf04d97-53ff-4c6e-9753-aede9535dfce'; -- Přítah na stroji s dopomocí

UPDATE exercises SET
  name_en = 'Overhand Rack Row', description_en = 'Overhand-grip pull-ups (chin-ups) on a rack bar are one of the best compound exercises for building back width and upper body strength. The exercise primarily targets the latissimus dorsi, but also engages the inter-scapular muscles and arms. Performing in a rack provides stability and a firm grip support.', setup_instructions_en = '1. Grip the pull-up bar with an overhand grip (thumbs facing each other) wider than shoulder-width.
2. Let your body hang freely with arms fully extended and shoulders relaxed.
3. Exhale and smoothly pull yourself up until your chin clears the bar.
4. At the top, briefly hold and then inhale and in a controlled manner lower yourself back to the starting position.'
WHERE id = 'b40a7926-d008-4d36-98da-c81750252e5e'; -- Přítah nadhmatem v rámu

UPDATE exercises SET
  name_en = 'Underhand Rack Row', description_en = 'Underhand-grip pull-ups (chin-ups) on a rack bar are a highly effective exercise for developing back and arm strength. Compared to the overhand grip, underhand pull-ups place greater emphasis on the biceps brachii and the lower portion of the latissimus dorsi. Performing in a rack ensures maximum structural stability for a smooth movement.', setup_instructions_en = '1. Grip the pull-up bar with an underhand grip (palms facing you) at approximately shoulder-width.
2. Start in a full hang with extended arms and shoulders.
3. Exhale and smoothly pull yourself up until your chin clears the bar.
4. At the top, briefly hold, then inhale and in a controlled manner lower yourself back to the starting position.'
WHERE id = '7ec72c4b-bafb-4cb6-b9ee-d5316be9ed58'; -- Přítah podhmatem v rámu

UPDATE exercises SET
  name_en = 'Band-Assisted Pull-up', description_en = '1. Attach a resistance band to the pull-up bar to create a loop for your knees or feet.
2. Hang from the bar with an overhand grip and rest your knees (or feet) on the band, which will assist by reducing your bodyweight.
3. Exhale and in a smooth movement pull yourself up until your chin is above the bar.
4. Inhale and in a controlled manner return to the starting position with extended arms.', setup_instructions_en = '1. Choose the band resistance according to your strength level - a stronger band provides greater assistance.
2. Make sure the band is securely attached to the bar.'
WHERE id = 'f5b5d117-6348-436d-b57d-4c44b76df5b6'; -- Přítah s dopomocí gumy

UPDATE exercises SET
  name_en = 'Smith Machine Bent-Over Row', description_en = '1. Grip the bar at shoulder-width with a pronated or supinated grip.
2. Hinge forward at the hips while keeping the back straight.
3. Pull the bar toward the upper abdomen.
4. Lower the bar in a controlled manner and repeat.', setup_instructions_en = 'Set the Smith machine bar to knee height or slightly above. Stand under the bar, hinge at the hips to 45-90 degrees. Keep the back flat, grip overhand.'
WHERE id = 'fc0eba80-93ab-46e9-bfa5-ffa4014fcdcf'; -- Přítah v předklonu na Smith stroji

UPDATE exercises SET
  name_en = 'Dumbbell Bent-Over Row', description_en = 'Bilateral bent-over rows with dumbbells are a foundational compound movement for building back thickness. Unlike supported variations, this exercise requires significant core and leg stabilizer activation to maintain proper torso position. The movement targets overall back development and improves the ability to maintain a rigid spine under load.', setup_instructions_en = '1. Stand with feet shoulder-width apart, holding a dumbbell in each hand.
2. Slightly bend the knees and hinge forward at the hips so the torso is at approximately 45 degrees (or nearly parallel) to the floor. Keep the back straight.
3. Let the arms hang freely downward, palms facing each other or toward the body.
4. On the exhale, pull both dumbbells simultaneously toward the waist. Keep the elbows close to the body and drive them backward.
5. At the top, squeeze the shoulder blades together firmly, then on the inhale, lower the dumbbells in a controlled manner back to full arm extension.'
WHERE id = 'ff22056a-5b93-4ad0-a193-57f5377ac55c'; -- Přítah v předklonu s jednoručkami

UPDATE exercises SET
  name_en = 'Kettlebell Bent-Over Row', description_en = 'The bent-over kettlebell row is a comprehensive strength exercise targeting the back muscles, particularly the latissimus dorsi, rhomboids, and rear deltoids. Maintaining a stable bent-over position simultaneously demands core strength and spinal erector engagement. The exercise helps improve posture and overall upper body strength.', setup_instructions_en = '1. Hold a kettlebell in each hand and stand with feet shoulder-width apart.
2. Slightly bend the knees and hinge forward at the hips to approximately 45°, keeping the back straight and the head in line with the spine.
3. Let the kettlebells hang freely in front of the body with arms extended.
4. On the exhale, drive the elbows upward toward the ceiling while consciously retracting the shoulder blades.
5. At the top, pause for a second and squeeze the back muscles hard.
6. On the inhale, slowly and in a controlled manner lower the kettlebells back to the starting position.'
WHERE id = 'c614dfc5-e417-44b8-9fbf-deef8be0dbea'; -- Přítah v předklonu s kettlebellem

UPDATE exercises SET
  name_en = 'Landmine Bent-Over Row', description_en = '1. Grip the bar at shoulder-width with a pronated or supinated grip.
2. Hinge forward at the hips while keeping the back straight.
3. Pull the weight toward the upper abdomen.
4. Lower the weight in a controlled manner and repeat.', setup_instructions_en = 'Set the landmine to a safe position. Grip the end of the bar with both hands or one hand. Hinge forward at the hips to 45-90 degrees, back flat.'
WHERE id = 'eb2b57db-7531-47df-ad20-c7b2b655ea9e'; -- Přítah v předklonu s landminem

UPDATE exercises SET
  name_en = 'Barbell Bent-Over Row', description_en = 'The bent-over barbell row is a fundamental strength exercise for building thickness and density in the back muscles. This compound movement engages the latissimus dorsi, trapezius, rhomboids, and spinal erectors. Performing it near the rack allows safe re-racking of the bar in the hooks after completing a set.', setup_instructions_en = '1. Grip the bar overhand or underhand at shoulder width and lift it off the rack hooks.
2. Slightly bend the knees and hinge at the hips so the back remains straight and nearly parallel to the floor.
3. On the exhale, pull the bar toward the upper abdomen, driving elbows along the body and squeezing the shoulder blades together.
4. At the top position, briefly flex the back muscles.
5. On the inhale, lower the bar in a controlled manner back to full arm extension.'
WHERE id = 'b12a50f8-630c-4c76-86d7-b2b632fca3a7'; -- Přítah v předklonu s osou

UPDATE exercises SET
  name_en = 'Incline Dumbbell Row', description_en = 'Chest-supported dumbbell rows on an incline bench are among the best exercises for isolating back muscles. The chest support prevents body swing and excessive lower back loading, allowing maximum focus on the muscular work of the back. The exercise effectively builds back thickness and improves posture.', setup_instructions_en = '1. Set the bench to approximately 45 degrees.
2. Lie chest-down on the bench, feet firmly planted on the floor for stability.
3. Grip the dumbbells overhand or with a neutral grip (palms facing each other).
4. On the exhale, pull the dumbbells toward the waist, keeping elbows close to the body and squeezing the shoulder blades together at the top.
5. On the inhale, lower the dumbbells in a controlled manner back to full arm extension without touching the floor.'
WHERE id = 'c572153a-5bae-4242-b008-3fdbf48fbcb7'; -- Přítahy jednoruček na šikmé lavici

UPDATE exercises SET
  name_en = 'Chest-Supported Machine Row', description_en = 'Chest-supported rows on the Panatta machine are a highly effective exercise for isolated development of the mid-back muscles and latissimus dorsi. The chest support eliminates lower back involvement and body sway, allowing maximum focus on scapular retraction and smooth pulling. The machine provides a natural movement path that is joint-friendly and precisely targets back depth.', setup_instructions_en = '1. Adjust the seat and chest pad height so that the handles are at the level of your lower ribs.
2. Sit down, press the chest firmly into the pad and grip the handles (overhand or neutral grip).
3. On the exhale, pull the handles toward you, driving elbows backward and actively retracting the shoulder blades.
4. Hold the rear position for one second at maximum muscle contraction.
5. On the inhale, return the handles in a controlled manner to the starting position until the back is fully stretched.'
WHERE id = '5f79bfbb-aaa0-45c2-a915-51d7f6169d72'; -- Přítahy na stroji s oporou hrudníku

UPDATE exercises SET
  name_en = 'Seated Machine Row', description_en = '1. Sit on the machine, press the chest against the padded support and grip the handles.
2. On the exhale, pull the handles toward you, driving elbows backward and squeezing the shoulder blades together.
3. Pause briefly at maximum contraction and fully flex the back muscles.
4. On the inhale, return the handles in a controlled manner to the starting position until the arms are nearly extended.', setup_instructions_en = '1. Adjust the seat height so that the handles are at the level of the lower chest or upper abdomen.
2. Load the appropriate number of weight plates onto the pegs.
3. Adjust the chest support so you can comfortably reach the handles with a slightly extended back.'
WHERE id = '50329fa1-fe6e-48ca-a23d-b7476999ae9c'; -- Přítahy na stroji vsedě

UPDATE exercises SET
  name_en = 'Torso Rotation', description_en = '1. Use a handle attachment or no attachment. Set the cable to the high position.
2. Step a few paces to the side so the cable comes from the opposite side to the working arm.
3. From there, perform horizontal shoulder abduction and adduction while keeping the elbows in a fixed position.', setup_instructions_en = 'Sit in the machine, back against the pad. Set the starting rotation angle. Grip the handles or rest forearms on the pads. Feet firmly on the foot rest.'
WHERE id = '1041cbb8-29af-44e7-8aed-a33932767d29'; -- Rotace trupu

UPDATE exercises SET
  name_en = 'Single-Leg Balance', description_en = 'Stand on one foot with eyes closed and hold the balance for at least one minute. Focus on pressure distributed across the little-toe edge, big-toe edge, and heel.', setup_instructions_en = 'Stand upright next to a support (if needed). Shift weight onto one foot, slightly bend the knee of the supporting leg. Fix your gaze on a stationary point.'
WHERE id = '00500167-6db4-4090-b197-740eb77e1adf'; -- Rovnováha na jedné noze

UPDATE exercises SET
  name_en = 'Cable Fly', description_en = 'The cable crossover is an isolation exercise targeting the pectoralis major. Unlike pressing with barbells, the cable maintains constant tension on the chest even at the phase when the hands come together (maximum contraction). This exercise is ideal for shaping the inner chest and overall pectoral separation. By varying cable height, the upper, middle, or lower chest can be targeted.', setup_instructions_en = '1. Set both cable pulleys to the desired height (usually high position) and attach single-handle grips.
2. Grip the handles, stand in the center between the pulleys, and take one step forward for a stable stance.
3. Lean slightly forward and keep the arms slightly bent at the elbows (as if hugging a barrel).
4. On the exhale, smoothly pull the handles together in front of the body until the hands are nearly touching. At this position, squeeze the pectoral muscles hard.
5. On the inhale, slowly and in a controlled manner return the arms out to the sides to a slight stretch.'
WHERE id = 'e0c7b35b-a57c-4d5c-9ede-30021e226489'; -- Rozpažení na kabelu

UPDATE exercises SET
  name_en = 'Dumbbell Fly', description_en = 'The flat dumbbell fly is an isolation exercise designed to target and stretch the pectoral muscles. Using dumbbells on a flat bench allows a deeper range of motion than a barbell, leading to better chest muscle activation and definition. The exercise places minimal demand on the triceps, allowing the pectoral muscles to do most of the work.', setup_instructions_en = '1. Lie on a flat bench, feet firmly planted on the floor for stability.
2. Raise the dumbbells above the chest with palms facing each other. Arms are nearly extended, elbows slightly bent.
3. On the inhale, slowly and in a controlled manner lower the dumbbells out to the sides until you feel a pleasant stretch in the chest.
4. The elbows should remain slightly bent throughout the movement; dumbbells should not drop below the level of the bench.
5. On the exhale, smoothly return the dumbbells back above the chest as if you are hugging someone.'
WHERE id = '1a125856-67ec-488b-b061-b794ae9c13c6'; -- Rozpažení s jednoručkami

UPDATE exercises SET
  name_en = 'Kettlebell Fly', description_en = 'The bent-over kettlebell reverse fly is a highly effective isolation exercise targeting the posterior deltoid and rhomboid muscles. This exercise helps improve shoulder stability, posture, and corrects muscular imbalances caused by excessive loading of the anterior side of the body.', setup_instructions_en = '1. Stand with feet shoulder-width apart, holding a kettlebell in one hand.
2. Hinge forward at the hips to approximately 45°, keeping the back straight and bracing the other hand on the knee for better stability.
3. Let the arm holding the kettlebell hang vertically downward, upper arm close to the body and elbow at 90°.
4. On the exhale, raise the arm in a controlled manner out to the side and backward until the arm is parallel to the floor.
5. At the top, pause for a second and firmly contract the posterior deltoid.
6. On the inhale, slowly and in a controlled manner return the arm to the starting position.'
WHERE id = '85c060a3-162e-4690-a8f5-5f50ea77cbd1'; -- Rozpažování s kettlebellem

UPDATE exercises SET
  name_en = 'Smith Machine Romanian Deadlift', description_en = '1. Stand shoulder-width apart and grip the bar with both hands overhand (both palms away) or with a mixed grip.
2. Push the hips back while keeping the knees mostly straight. You should feel a stretch in the hamstrings.
3. When you feel the stretch, drive the hips forward until you return to a standing position.', setup_instructions_en = 'Set the bar at hip height. Stand shoulder-width apart, toes forward. Grip the bar overhand and unlock the machine. Back straight.'
WHERE id = 'a545c027-7cc1-4e49-85e3-e519a9fc8d2e'; -- Rumunský mrtvý tah na Smith stroji

UPDATE exercises SET
  name_en = 'Romanian Deadlift on Platform', description_en = '1. Take a shoulder-width grip with both palms facing forward or use a mixed grip.
2. Push the hips back and keep the legs nearly straight. You should feel a stretch in the hamstrings.
3. When you feel the stretch, drive the hips forward until you return to a standing position.', setup_instructions_en = 'Stand shoulder-width apart, toes forward. Both overhand and alternating grip are acceptable - with alternating grip there is a small risk of bicep strain. Avoid shrugging the shoulders - this is a posterior chain movement, not a trapezius movement.'
WHERE id = '7799eed7-3b7f-4dde-a5ba-6a2073768fb6'; -- Rumunský mrtvý tah na plošině

UPDATE exercises SET
  name_en = 'Machine Romanian Deadlift', description_en = '1. Stand on the machine platform with feet hip-width apart and grip the loaded machine bar overhand.
2. On the inhale, begin slowly pushing the hips back (hip hinge) and let the bar descend along the legs.
3. Lower until you feel a strong stretch in the hamstrings, keeping the back straight and core braced.
4. On the exhale, squeeze the glutes and hamstrings and return to the upright position by driving the hips forward in a smooth movement.', setup_instructions_en = '1. Load the appropriate weight plates onto the machine pegs.
2. Ensure you are standing stable in the center of the platform so the bar path moves smoothly.'
WHERE id = '8a8af7b8-9af6-4e62-9c0f-e8ed0ddb4381'; -- Rumunský mrtvý tah na stroji

UPDATE exercises SET
  name_en = 'Dumbbell Romanian Deadlift', description_en = 'The Romanian deadlift (RDL) is one of the most effective exercises for developing the posterior thigh (hamstrings) and glute muscles. Unlike the conventional deadlift, the dumbbells are not set down on the floor and the movement primarily focuses on the hip hinge. The dumbbell version offers better control over the movement path and equal loading of both limbs.', setup_instructions_en = '1. Stand with feet hip-width apart, holding dumbbells in front of the thighs.
2. Slightly bend the knees (this angle remains constant throughout).
3. On the inhale, begin slowly pushing the hips back and hinging forward. Keep the dumbbells close to the legs at all times.
4. Lower to the point where you feel a strong stretch in the hamstrings (usually below the knees), while keeping the back straight.
5. On the exhale, return to an upright position by pressing through the heels and activating the glutes.'
WHERE id = '03d7a9b7-6332-41e7-9af1-9206fd3bcaff'; -- Rumunský mrtvý tah s jednoručkami

UPDATE exercises SET
  name_en = 'Kettlebell Romanian Deadlift', description_en = 'The kettlebell Romanian deadlift is a foundational compound exercise targeting the entire posterior chain, particularly the hamstrings and glutes. Unlike the conventional deadlift, the movement initiates with the hips moving backward with minimal knee bend, placing maximum emphasis on the stretch and subsequent contraction of the posterior thigh.', setup_instructions_en = '1. Stand upright with feet hip-width apart, holding a kettlebell in each hand (or one with both hands) in front of the body.
2. On the inhale, begin slowly shifting the hips back, keeping the back straight and the knees only slightly bent.
3. Lower the kettlebells close along the legs toward the floor until you feel a strong stretch in the hamstrings.
4. On the exhale, return to the upright stance by pressing through the heels and strongly squeezing the glutes at the top.'
WHERE id = 'dc49667d-95e8-4e2a-9ead-814baa69483b'; -- Rumunský mrtvý tah s kettlebellem

UPDATE exercises SET
  name_en = 'Rack Romanian Deadlift', description_en = 'The rack Romanian deadlift (in a half rack) is an excellent exercise for strengthening the entire posterior chain, particularly the glutes and hamstrings. Unlike the conventional deadlift, the movement starts from the top from the hooks, which allows better control over the eccentric (lowering) phase. Training in the rack increases safety when handling a heavy barbell.', setup_instructions_en = '1. Set the rack hooks so the barbell is slightly below the level of your palms when standing upright.
2. Grip the bar overhand or with an alternating grip at shoulder width and lift it off the hooks.
3. Step back, brace the core, and slightly bend the knees.
4. On the inhale, lower the bar in a controlled manner along the thighs by pushing the hips back (keeping the back straight).
5. Once you feel maximum stretch in the hamstrings, on the exhale use the glutes to return to the upright position.'
WHERE id = 'd6c2f1a8-f314-4cd2-9047-0749455af07b'; -- Rumunský mrtvý tah v rámu

UPDATE exercises SET
  name_en = 'Overhand Pull-ups', description_en = 'The overhand pull-up is one of the best bodyweight exercises for building back strength and width. The movement primarily targets the latissimus dorsi, but also significantly engages the rhomboids, rear deltoids, and biceps. Regular pull-up training improves posture and builds functional upper body strength.', setup_instructions_en = '1. Grip the bar overhand slightly wider than shoulder-width.
2. Hang with arms extended and brace the core (legs may be slightly in front of the body).
3. On the exhale, pull yourself smoothly upward until the chin clears the bar. Focus on driving the elbows down toward the waist.
4. At the top, hold for a second, then on the inhale lower yourself in a controlled manner back to full arm extension.'
WHERE id = '7d90e704-b99e-42cc-ad2b-e67d2270af0f'; -- Shyby nadhmatem

UPDATE exercises SET
  name_en = 'Chin-ups', description_en = 'The chin-up is one of the best compound exercises for the upper body. Due to the underhand grip with palms facing the face, the biceps are heavily involved, making this an excellent tool for building both arm strength and the latissimus dorsi. This variation is often easier for beginners than the overhand pull-up, but offers extreme intensity for muscle growth.', setup_instructions_en = '1. Grip the bar underhand (palms facing you) approximately shoulder-width apart.
2. Hang with arms extended and brace the core.
3. On the exhale, pull yourself smoothly upward until the chin clears the bar. Focus on driving the elbows down and toward the body.
4. At the top, firmly contract the biceps and back muscles.
5. On the inhale, lower yourself in a controlled manner back to full arm extension.'
WHERE id = 'e83da6bf-7aa3-4719-b7c2-f96d4149694c'; -- Shyby podhmatem

UPDATE exercises SET
  name_en = 'Sissy Squat', description_en = '1. Position the sissy squat pad behind the knees and press the front pad against the ankles.
2. Hold a single dumbbell in the goblet position (at the chest).
3. Sit straight down into the squat. Then press the calves into the back of the pad and return the knees to the starting position.', setup_instructions_en = 'Set the ankle support on the machine. Stand upright, grip the machine for stability. Ankles in the support, feet close together.'
WHERE id = '3052d62d-148d-4356-b789-6881f44756c0'; -- Sissy dřep

UPDATE exercises SET
  name_en = 'Bench Crunches', description_en = '1. Lie on a decline bench head-down and hook the feet firmly behind the pads.
2. Place hands behind the head or cross them on the chest.
3. On the exhale, use the abdominal muscles to raise the upper body toward the knees.
4. At the top, briefly contract the abdominals, then on the inhale return in a controlled manner.', setup_instructions_en = '1. Set the bench incline - the steeper the angle, the greater the difficulty.
2. Ensure the feet are safely secured in the padding.'
WHERE id = 'efd19f54-2676-4702-9aa6-bd0f44153c49'; -- Sklapovačky na lavičce

UPDATE exercises SET
  name_en = 'Skull Crusher', description_en = 'The skull crusher (lying French press) with an EZ bar is one of the most effective isolation exercises for tricep development, particularly the long head. Using the EZ bar reduces wrist stress and allows a more natural grip. The exercise focuses on deep muscle stretch in the bottom phase and strong contraction at full extension, leading to effective arm mass development.', setup_instructions_en = '1. Lie on a flat bench, feet firmly on the floor.
2. Grip the EZ bar with a narrow inner overhand grip and extend it above the chest with arms straight.
3. Fix the upper arms in one position and on the inhale slowly lower the bar in a controlled arc toward the forehead.
4. Stop just above the forehead and on the exhale use tricep force to press the bar back to the starting position.
5. At the top, briefly contract the triceps, but do not lock out the elbows abruptly.'
WHERE id = 'd291b18b-1ef0-4eda-95cc-b7696c2b2515'; -- Skull crusher 

UPDATE exercises SET
  name_en = 'Dumbbell Skull Crusher', description_en = 'The dumbbell skull crusher (French press) is an excellent isolation exercise for the triceps. Performing it with dumbbells on a flat bench allows greater freedom of movement at the wrists and elbows, which can be more joint-friendly than the barbell variation. The exercise primarily targets the long head of the triceps and helps build both strength and definition in the back of the arms.', setup_instructions_en = '1. Lie on a flat bench, feet firmly on the floor.
2. Raise the dumbbells directly above the shoulders with arms extended, palms facing each other (neutral grip).
3. On the inhale, slowly bend only the elbows and lower the dumbbells in a controlled manner toward the temples or just beside the ears.
4. The upper arms must remain stationary and perpendicular to the floor throughout the movement.
5. On the exhale, use the triceps to press the dumbbells back to the starting position above the shoulders.'
WHERE id = '5e738405-276b-4112-93c7-a1b1b79f5c7c'; -- Skull crusher s jednoručkami

UPDATE exercises SET
  name_en = 'Kettlebell Skull Crusher', description_en = 'The kettlebell skull crusher is an intense isolation exercise targeting all three heads of the triceps. Performing it on a bench with a kettlebell allows a deeper stretch of the muscle in the bottom phase due to the specific center of gravity of the implement, leading to more effective stimulation and arm muscle mass gains.', setup_instructions_en = '1. Lie on your back on a flat bench and grip the kettlebell with both hands by the handle (or on the sides).
2. Raise the kettlebell above the chest with arms extended so the palms face each other.
3. On the inhale, slowly lower the kettlebell in a controlled movement toward the forehead or slightly behind the head, keeping the upper arms stationary and perpendicular to the floor.
4. The movement comes only from the elbows; keep them close together and not flared out.
5. On the exhale, use tricep force to return the kettlebell by straightening the elbows back to the starting position above the chest.'
WHERE id = '8c7f59b5-5b38-4c13-82a2-c43768ab3afe'; -- Skull crusher s kettlebellem

UPDATE exercises SET
  name_en = 'Curved Treadmill Sprint', description_en = 'Sprinting on a curved non-motorized treadmill is a maximally intense activity targeting explosive power, maximum speed, and anaerobic capacity. Because the belt responds instantly to your force, it allows natural acceleration without waiting for a motor. This exercise extremely engages the hamstrings and glutes.', setup_instructions_en = '1. Start at a light jog to get the belt moving.
2. Once ready, lean slightly forward and begin accelerating hard through the forefoot.
3. Move as close to the front (top) of the curve as possible for maximum speed.
4. Work the arms vigorously along the body for stability and power.
5. To end the sprint, gradually decelerate by shifting the center of gravity backward, or carefully grab the handles and step to the side rails.'
WHERE id = '4a4f2c2d-1693-4e01-92c3-e56ddf56dcbd'; -- Sprint na prohnutém bezmotorovém pásu

UPDATE exercises SET
  name_en = 'Stationary Bike', description_en = '1. Hold the handles and maintain a neutral spine position.
2. Pedal at a steady pace and minimize side-to-side rocking.', setup_instructions_en = 'Adjust the saddle height so the knee remains slightly bent at the bottom of the pedal stroke. Grip the handlebars in a natural position, back slightly inclined forward.'
WHERE id = '02d56b70-159a-4c7c-8d6c-48a74d1e9b1b'; -- Stacionární kolo

UPDATE exercises SET
  name_en = 'Wide-Grip High Cable Pulldown', description_en = '1. Grip the bar overhand with hands placed wider than shoulder-width.
2. Lean back slightly (approximately 30 degrees), lift the chest, and fix the gaze slightly upward.
3. In a smooth movement, pull the bar to the upper chest while consciously retracting the shoulder blades.
4. Pause briefly in the bottom position, then return the bar in a controlled manner to full arm extension.', setup_instructions_en = '1. Adjust the thigh pad height so it firmly holds you in the seat with feet on the floor.
2. Select the appropriate weight and sit with an upright back.'
WHERE id = '3373f944-88ae-47da-b32d-eb55b2512245'; -- Stahování horní kladky širokým úchopem

UPDATE exercises SET
  name_en = 'Lat Machine Pulldown', description_en = 'The high row on a plate-loaded machine is a top-tier exercise for building both back width and thickness. The specific movement path, which leads from above downward and slightly toward the body, achieves maximum stretch and then strong contraction of the latissimus dorsi. The machine allows independent arm movement, which helps correct muscular imbalances and ensures natural movement mechanics.', setup_instructions_en = '1. Adjust the seat and knee pad height so you are firmly braced with feet on the floor and against the pads.
2. Grip the handles overhand (approximately shoulder-width) and sit down.
3. On the exhale, pull the handles smoothly down toward the chest, driving elbows toward the body and actively retracting the shoulder blades.
4. Hold the bottom position for one second at maximum contraction.
5. On the inhale, slowly return to the starting position until the arms are fully extended and the back is fully stretched.'
WHERE id = 'd13d13f2-58bf-42dd-81da-488d87aa5919'; -- Stahování na lat. stroji

UPDATE exercises SET
  name_en = 'Lat Machine Pulldown', description_en = '1. Grip the bar overhand with hands placed wider than shoulder-width.
2. Lean back slightly (approximately 30 degrees), lift the chest, and fix the gaze slightly upward.
3. In a smooth movement, pull the bar to the upper chest while consciously retracting the shoulder blades.
4. Pause briefly in the bottom position, then return the bar in a controlled manner to full arm extension.', setup_instructions_en = '1. Adjust the thigh pad height so it firmly holds you in the seat with feet on the floor.
2. Select the appropriate weight and sit with an upright back.'
WHERE id = '26f0f442-8029-47d8-b2bf-954a97032ec3'; -- Stahování na lat. stroji

UPDATE exercises SET
  name_en = 'Lat Machine Pulldown', description_en = '1. Grip the bar with palms facing forward, hands placed wider than shoulder-width.
2. With both arms extended forward holding the bar, lean the torso back approximately 30 degrees and lift the chest.
3. Pull the bar smoothly down to chin level or slightly below, simultaneously squeezing the shoulder blades together.
4. After a brief squeeze, slowly raise the bar back to the starting position with arms fully extended.', setup_instructions_en = 'Set the thigh pad to a height that allows you to fully insert your legs under it while still being firmly held in the seat. Grip the bar overhand just inside the bend - you may use a thumbed or thumbless grip. Hold the bar firmly, sit straight down, and insert legs under the pad.'
WHERE id = '3a189db0-4a0d-48bc-9595-42617b4a839c'; -- Stahování na lat. stroji

UPDATE exercises SET
  name_en = 'Underhand Lat Pulldown', description_en = '1. Grip the bar underhand (palms toward you), hands approximately shoulder-width apart.
2. With a slight backward lean and chest lifted, pull the bar smoothly to the upper chest.
3. In the bottom phase, consciously press the shoulder blades together and downward, and pause for a second.
4. On the inhale, return the bar in a controlled manner to the starting position until the arms are fully extended.', setup_instructions_en = '1. Set the thigh pad height to firmly fix you in the seat.
2. Select the appropriate weight and sit with a straight back.'
WHERE id = '7d74691b-9479-40c3-ba84-67e7b274e391'; -- Stahování podhmatem

UPDATE exercises SET
  name_en = 'Wide-Grip Pulldown', description_en = '1. Grip the bar with palms facing forward, hands wider than shoulder-width.
2. With both arms extended forward holding the bar, lean the torso back approximately 30 degrees and lift the chest.
3. Pull the bar smoothly down to approximately chin level or slightly below, simultaneously squeezing the shoulder blades together.
4. After a brief squeeze, slowly return the bar to the starting position with arms fully extended.', setup_instructions_en = 'Set the thigh pad to a height that allows you to fully insert your legs under it while still being firmly held in the seat. Grip the bar overhand just inside the bend - you may use a thumbed or thumbless grip. Hold the bar firmly, sit straight down, and insert legs under the pad.'
WHERE id = '16faf814-8c66-4fae-9bba-3543dc2b8410'; -- Stahování širokým úchopem

UPDATE exercises SET
  name_en = 'Stepper', description_en = 'On the stepper, alternately step both feet into the individual compartments of the fitness machine as if climbing stairs. Place the feet beneath you so the knees are at approximately a 90-degree angle. Hold the machine''s handles and maintain an upright posture without leaning the torso forward. It is important to push primarily through the front of the foot and not let the knees cave inward - focus on keeping them in line with the toes.', setup_instructions_en = 'Step onto the stepper pedals, grip the handles for stability. Set the resistance and tempo. Stand upright with slightly bent knees.'
WHERE id = 'e4fd1afe-9ca3-487d-a55e-cb853a97ca66'; -- Stepper

UPDATE exercises SET
  name_en = 'Standing Multi-Squat Machine', description_en = '1. Stand shoulder-width apart, maintain a natural back arch, place the bar on the back, squeeze the shoulder blades.
2. Grip the bar across the shoulders, unlock the Smith machine by straightening the legs.
3. Bend the knees and lower the weight until the hips are below knee level.
4. Press the weight back up, drive through the legs, and exhale at the top.', setup_instructions_en = 'Set up the machine so you can brace against the shoulder pad while also achieving full stretch at the bottom.'
WHERE id = '1533fb6b-ccfa-44a8-8472-442c1e5f9c5c'; -- Stojatý multidřep

UPDATE exercises SET
  name_en = 'Super Pendulum Squat', description_en = '1. Stand in the hack squat machine with your back against the pad and shoulders under the cushions.
2. Place feet shoulder-width apart on the platform. Keep the back straight and slowly lower into the squat position.
3. Push through the heels and return to the starting position with core engaged. Repeat for the required reps and sets.', setup_instructions_en = 'Get into the machine, rest shoulders under the pads or grip the handles. Feet on the platform shoulder-width apart. Back in its natural curve. Unlock the machine.'
WHERE id = '1b9aaa6d-b227-48c0-8b1a-e31661ad8711'; -- Super pendulový dřep

UPDATE exercises SET
  name_en = 'Super Pendulum Front Squat', description_en = '1. Stand in the hack squat machine with your back against the pad and shoulders under the cushions.
2. Place feet shoulder-width apart on the platform. Keep the back straight and slowly lower into the squat position.
3. Push through the heels back to the starting position and keep the core engaged. Repeat for the required reps and sets.', setup_instructions_en = 'Get into the machine facing the platform. Rest shoulders under the pads. Feet on the platform slightly higher or further forward. Unlock the machine.'
WHERE id = '47b6ceab-433a-46ac-872f-4da00b91f243'; -- Super pendulový dřep vpředu

UPDATE exercises SET
  name_en = 'Sled Pull', description_en = 'Stand facing the sled, grip the handle with both hands, and drag it toward you in a lowered body position. Keep the legs in a wide stance for stability and maintain a straight back throughout the pull. The exercise primarily activates the legs, glutes, and upper back. Focus on making the movement smooth and controlled - avoid sudden jerks and never round the back to ensure spinal safety.', setup_instructions_en = 'Attach a rope or strap to the sled. Stand facing the sled, grip the rope with both hands. Lean slightly forward, rope under tension.'
WHERE id = '1f625d72-a75f-4460-be5a-6e2fe90e2c7a'; -- Tah saní

UPDATE exercises SET
  name_en = 'Decline Chest Press', description_en = '1. Adjust the seat height to your body.
2. Press the weight forward until your elbows are nearly straightened. Return to the starting position without letting the weight rest at the bottom until the set is finished.', setup_instructions_en = 'Adjust the seat - handles at lower chest level. Sit down, back against the pad, feet on the floor. Grip the handles with elbows slightly lower.'
WHERE id = 'a1d67e62-b3c9-4a54-a40c-471c03260993'; -- Tlak na prsa dolů

UPDATE exercises SET
  name_en = 'Overhead Press', description_en = '1. Grip the bar at shoulder width. Forearms should be vertical, forming a straight line from elbow to fist.
2. Pull the chin back and press the bar toward the ceiling by extending at the elbow joint and flexing at the shoulder.
3. Press until the elbows are fully extended, then slightly shift the head forward.
4. Return to the starting position in a controlled manner. Pull the chin back so the bar passes safely past the face.', setup_instructions_en = 'Set the hooks in the rack just below shoulder level - you should not need to stand on your toes. Grip the bar at shoulder-width or slightly wider, hold the bar deep in the palm (otherwise the wrists will bend and cause pain). Drive elbows under the bar to collarbone level. Slightly bend the knees and unrack the bar. Step back two steps.'
WHERE id = '60c7135b-8c64-456a-adc6-461404762bb7'; -- Tlak nad hlavu

UPDATE exercises SET
  name_en = 'Machine Overhead Press', description_en = '1. Grip the bar approximately shoulder-width apart. There should be a straight line from elbow to fist (vertical forearms).
2. Pull the chin back and press the weight toward the ceiling by extending at the elbow joint and flexing at the shoulder joint.
3. Press until the elbows are fully extended, then shift the head slightly forward.
4. Return to the starting position in a controlled manner. Pull the chin back so the weight passes safely past the face.', setup_instructions_en = 'Set the hooks in the rack just below shoulder level - you should not need to stand on your toes. Grip the bar at shoulder-width or slightly wider, hold the bar deep in the palm (otherwise the wrists will bend and cause pain). Drive elbows under the bar to collarbone level. Slightly bend the knees and unrack the bar. Step back two steps.'
WHERE id = 'e796dc2c-0c37-4e1a-9fba-4b78f5c2c5ca'; -- Tlak nad hlavu na stroji

UPDATE exercises SET
  name_en = 'Dumbbell Overhead Press', description_en = 'Seated overhead dumbbell presses are one of the most effective exercises for building shoulder strength and size. The back support eliminates leg involvement and limits lumbar hyperextension, allowing more isolated shoulder work. Using dumbbells ensures balanced development of both arms and a greater range of motion than a barbell variation.', setup_instructions_en = '1. Sit on a bench with the backrest set nearly vertical (approximately 80-90 degrees).
2. Raise the dumbbells to shoulder level, palms facing forward, elbows below the dumbbells.
3. On the exhale, press the dumbbells smoothly overhead until the arms are nearly extended.
4. At the top, do not bang the dumbbells together - maintain control.
5. On the inhale, slowly lower the dumbbells back to shoulder level, approximately at ear height.'
WHERE id = 'd60e9853-3577-4e19-a813-e73783cfef1d'; -- Tlak nad hlavu s jednoručkami

UPDATE exercises SET
  name_en = 'Rack Overhead Press', description_en = 'The overhead press in a rack (military press) is a foundational strength exercise for building powerful shoulders and upper body strength. Performing it in a rack allows safe unracking of the bar from hooks at shoulder height and provides stability for strict vertical pressing. The exercise primarily targets the anterior and medial deltoids, but also significantly engages the triceps and core stabilizers.', setup_instructions_en = '1. Set the rack hooks to approximately upper chest height.
2. Grip the bar overhand slightly wider than shoulder-width and unrack it.
3. Stand upright with feet shoulder-width apart and brace the core.
4. On the exhale, press the bar smoothly overhead until the arms are fully extended (at the top, slightly push the head forward).
5. On the inhale, lower the bar in a controlled manner back to the upper chest.'
WHERE id = 'e9d9724f-7154-4867-a88f-8f37e20d3ed0'; -- Tlak nad hlavu v rámu

UPDATE exercises SET
  name_en = 'Seated Smith Machine Overhead Press', description_en = '1. Sit on the bench with a backrest. Raise the bar to shoulder height, palms facing forward.
2. Press the bar upward and hold at the fully contracted top position.
3. Lower the bar back to the starting position.', setup_instructions_en = 'Set the bench under the Smith machine, back supported by the backrest. Adjust bar height to shoulder level. Grip the bar at shoulder-width or slightly wider.'
WHERE id = '9d991202-cfa8-4aa3-ac80-f13fb9ab543f'; -- Tlak nad hlavu vsedě na Smith stroji

UPDATE exercises SET
  name_en = 'Seated Rack Overhead Press', description_en = 'The seated overhead press in a rack is an excellent strength exercise for isolated shoulder development without significant lower limb involvement. Sitting on the bench provides stable back support, allowing full focus on maximum output and strict technique. Using the rack ensures safety through precise hook height and safety stop adjustment.', setup_instructions_en = '1. Position the bench in the rack and set the backrest to a vertical or slightly inclined position.
2. Set the rack hooks so the bar is at shoulder level or slightly above.
3. Sit on the bench, grip the bar overhand slightly wider than shoulder-width and unrack it.
4. On the exhale, press the bar smoothly overhead until the arms are fully extended.
5. On the inhale, lower the bar in a controlled manner back to the upper chest.'
WHERE id = '44246dc8-c44d-4a3d-8de9-aa4c0e75baf1'; -- Tlak nad hlavu vsedě v rámu

UPDATE exercises SET
  name_en = 'Dumbbell Press', description_en = 'The flat dumbbell press is a fundamental exercise for developing the pectoralis major. Compared to the barbell version, dumbbells allow a greater range of motion and require a higher degree of stabilization, engaging more assisting muscles. The exercise is key for building functional upper body strength.', setup_instructions_en = '1. Lie on a flat bench, feet firmly and fully planted on the floor for maximum stability.
2. Raise the dumbbells above the chest with arms extended, palms facing forward.
3. On the inhale, slowly lower the dumbbells to the outer chest.
4. Keep the elbows at approximately 45-60 degrees from the body (neither completely tucked nor directly in line with the shoulders).
5. On the exhale, press the dumbbells smoothly back up until the arms are nearly extended.'
WHERE id = 'b834f2e4-4227-4d7e-9c23-05878b1dde9a'; -- Tlak s jednoručkami

UPDATE exercises SET
  name_en = 'Bottoms-Up Kettlebell Press', description_en = 'The bottoms-up kettlebell press is an advanced exercise targeting shoulder stability and grip strength. Holding the kettlebell upside down requires constant activation of shoulder stabilizers and the deep stabilizing system to prevent the weight from tipping over. The exercise significantly improves overall press mechanics and shoulder joint health.', setup_instructions_en = '1. Stand shoulder-width apart and hold a kettlebell in one hand with the bottom facing up.
2. Bring the kettlebell to the shoulder with the palm facing the center of the body and the elbow bent.
3. From this position, press the arm in a controlled manner upward until fully extended overhead.
4. Maintain a stable core and straight back throughout the movement.
5. Slowly and in a controlled manner return the kettlebell to the starting position at the shoulder.'
WHERE id = '7b9ce0ea-3361-47f6-b104-422d9a46714c'; -- Tlak s kettlebellem dnem nahoru

UPDATE exercises SET
  name_en = 'Incline Kettlebell Press', description_en = 'The incline kettlebell press is an effective strength exercise targeting the upper pectoralis major and anterior deltoids. Using kettlebells instead of a barbell allows a greater range of motion and places higher demands on shoulder stabilization. The incline bench position at 30-45 degrees optimally targets the muscle fibers in the subclavicular area of the chest.', setup_instructions_en = '1. Set the incline bench to 30-45 degrees and sit on it.
2. Hold a kettlebell in each hand and lean back on the bench, holding the kettlebells at the shoulders (chest level).
3. Keep feet firmly planted on the floor for maximum stability.
4. On the exhale, press the kettlebells upward in a smooth movement until the arms are nearly extended.
5. At the top, pause for a second and consciously squeeze the pectoral muscles.
6. On the inhale, slowly and in a controlled manner lower the kettlebells back to the starting position.'
WHERE id = 'f39d1259-2233-453b-bf46-3d1db48fda2d'; -- Tlak s kettlebellem na šikmé lavici

UPDATE exercises SET
  name_en = 'Kettlebell Overhead Press', description_en = 'This exercise is performed lying on an incline bench and resembles a classic bench press. Start lying on your back with the kettlebells pressed above you. Pull the elbows down toward the floor to bring the kettlebells to the bottom phase, where it is recommended to briefly pause to eliminate momentum, then press the weight back to full arm extension.', setup_instructions_en = '1. Set the bench to 30-45°.
2. Lie on your back (face up).
3. Hold a kettlebell in one or both hands at chest level.
4. Keep feet firmly planted on the floor.'
WHERE id = 'a4513d18-beb4-4de8-8ec3-6f61dcfeba32'; -- Tlak s kettlebellem nad hlavu

UPDATE exercises SET
  name_en = 'Kettlebell Overhead Press', description_en = '1. During the press, maintain a straight line from elbow to fist (vertical forearm).
2. Sit upright and try not to hyperextend the spine during the movement.
3. Press the kettlebell upward to full arm extension, then at the top slightly push the elbow and head forward.', setup_instructions_en = '1. Sit on a bench with an upright back.
2. Hold the kettlebell at shoulder level - the grip should be at the fingertips, hand firmly closed.
3. Elbow points slightly forward.'
WHERE id = '91f268a7-3621-44cb-9395-80dd30d5961e'; -- Tlak s kettlebellem nad hlavu

UPDATE exercises SET
  name_en = 'Standing Kettlebell Overhead Press', description_en = '1. There should be a straight line from elbow to fist (vertical forearm).
2. Stand upright and do not hyperextend the spine during the press.
3. Press the kettlebell upward to full arm extension, then at the top slightly push the elbow and head forward.', setup_instructions_en = '1. Stand upright with feet shoulder-width apart.
2. Hold the kettlebell at shoulder level with the handle at the fingertips.
3. Place the other hand on the hip for better stability.'
WHERE id = '002234f1-5118-4973-9245-d72c26e66462'; -- Tlak s kettlebellem nad hlavu vstoje

UPDATE exercises SET
  name_en = 'Sled Push', description_en = 'Lie on the floor with knees bent and feet on the ground. Place a sled or slider under your back and push yourself upward by pulling with the arms until the body is supported only on the heels and head. Return to the starting position and repeat. The exercise can be made more challenging by elevating the feet or adding weight to the chest.

Keep the body tense and in a straight line during the movement, moving only with the arms. Focus on activating the abdominals and controlling the movement - you do not need to go to maximum effort - slow, quality performance with proper form is more effective.', setup_instructions_en = 'Stand behind the sled in a stable, low stance. Place forearms or hands on the sled handles. Body in a straight line from head to heels.'
WHERE id = '122a3ecd-41ef-4b1f-b1df-251c0aabcc42'; -- Tlak saní

UPDATE exercises SET
  name_en = 'Pectoral Machine Press', description_en = '1. Sit on the machine, back firmly against the pad, and rest forearms on the padded supports.
2. Grip the handles so your arms form approximately a 90-degree angle at the elbows.
3. On the exhale, press the pads together in a smooth movement in front of the chest until they are parallel.
4. At the moment of maximum contraction, squeeze the pectoral muscles for one second.
5. On the inhale, return in a controlled manner to the starting position until you feel a slight chest stretch.', setup_instructions_en = '1. Adjust the seat height so your elbows and shoulders are level (elbows should not be higher than shoulders).
2. Adjust the weight to your current fitness level.'
WHERE id = '21c2c047-7788-4f53-87f6-0d41db5aacf8'; -- Tlaky na pektorálním stroji

UPDATE exercises SET
  name_en = 'Shoulder Press', description_en = 'The plate-loaded shoulder press machine allows maximum deltoid overloading with a natural movement path. Unlike selectorized machines, weight can be adjusted with high precision using plates. The machine structure provides trunk stability, allowing full focus on pressing power without the need to balance free weights.', setup_instructions_en = '1. Load the appropriate number of weight plates onto the machine pegs.
2. Adjust the seat height so the handles start at approximately shoulder level.
3. Sit down, brace firmly against the pad, and grip the handles (overhand or neutral grip).
4. On the exhale, press the weight overhead, but do not fully lock out the elbows at the top.
5. On the inhale, slowly and in a controlled manner lower the weight back to the starting position.'
WHERE id = '438c15e1-9942-4bc8-93d3-e2e41b1bbb11'; -- Tlaky na ramena

UPDATE exercises SET
  name_en = 'Shoulder Press', description_en = 'The selectorized shoulder press machine primarily targets the anterior and medial deltoid heads. The machine guides the movement along a fixed path, minimizing injury risk and allowing maximum focus on muscle work. This is an ideal exercise for safely building shoulder size and strength without the need to stabilize free weights.', setup_instructions_en = '1. Adjust the seat height so the handles are at or slightly below shoulder level.
2. Select the weight by inserting the pin into the weight stack.
3. Sit firmly against the backrest, feet fully flat on the floor.
4. Grip the handles and on the exhale press them upward (do not fully lock the elbows).
5. On the inhale, slowly and in a controlled manner lower the handles back to ear level.'
WHERE id = '376eedcd-6b19-4738-8fa5-fcbb84a72b0a'; -- Tlaky na ramena

UPDATE exercises SET
  name_en = 'Cable Overhead Tricep Extension', description_en = 'Overhead cable extensions with a rope are one of the best exercises for targeting the long head of the triceps. With the arms positioned overhead, the muscle reaches maximum stretch at the starting position. The constant cable pull ensures the triceps work throughout the full range of motion, leading to significant improvement in arm muscle volume and strength.', setup_instructions_en = '1. Set the cable to the low or mid position and attach a rope adapter.
2. Grip the rope, turn your back to the machine, and raise the arms so the elbows point upward and the rope is behind the head.
3. Choose a stable stance (one foot can be stepped forward).
4. On the exhale, smoothly extend the arms upward and slightly apart until the elbows are nearly straight.
5. On the inhale, lower the rope in a controlled manner back behind the head to maximum tricep stretch.'
WHERE id = 'af92c9b3-cd6c-41fc-aba6-540ad26fcd85'; -- Tricepsové extenze nad hlavou na kladce

UPDATE exercises SET
  name_en = 'Kettlebell Overhead Tricep Extension', description_en = '1. Hold the kettlebell overhead.
2. Bend at the elbows until the kettlebell is behind the head.
3. Then extend the elbows until the kettlebell returns to the starting position.', setup_instructions_en = '1. Stand upright or sit down.
2. Hold the kettlebell with both hands by the flat part overhead with arms extended.
3. Keep elbows at ear level.'
WHERE id = 'f0dca7d4-b14d-4094-bdb9-c6e20e589681'; -- Tricepsové natažení nad hlavou s kettlebellem

UPDATE exercises SET
  name_en = 'EZ Bar Overhead Tricep Extension', description_en = 'The overhead EZ bar tricep extension is an excellent exercise for deep tricep stretch, particularly of the long head. The overhead arm position creates maximum stretch of the muscle fibers in the bottom phase, which significantly stimulates muscle growth. The curved EZ bar helps keep the wrists in a more natural and safer position throughout the movement.', setup_instructions_en = '1. Sit on a bench with a low backrest or stand upright with feet shoulder-width apart.
2. Grip the EZ bar with a narrow overhand grip and raise it directly overhead with arms extended.
3. Fix the upper arms at the ears and on the inhale slowly lower the bar in a controlled movement behind the head.
4. Once you feel maximum tricep stretch, on the exhale press the bar back to the starting position overhead.
5. At the top, squeeze the triceps but do not fully lock the elbows.'
WHERE id = '01393297-24b1-4e7c-86c2-77c951f44cb3'; -- Tricepsové natažení za hlavou s EZ tyčí

UPDATE exercises SET
  name_en = 'Dumbbell Overhead Tricep Extension', description_en = 'This tricep extension variation is performed standing with both arms, which requires strong activation of trunk stabilizing muscles. The exercise targets the long head of the triceps and allows deep muscle stretch under load. Performing with two dumbbells ensures symmetric development of both arms.', setup_instructions_en = '1. Stand with feet shoulder-width apart, holding a dumbbell in each hand.
2. Raise both arms directly overhead so palms face each other.
3. On the inhale, slowly lower both dumbbells simultaneously behind the head by bending only at the elbows.
4. Keep the upper arms stationary at the ears and elbows pointing forward.
5. On the exhale, press the dumbbells in a controlled manner back to extended arms overhead.'
WHERE id = '62919c08-42ff-4c59-bfc0-356847fb5334'; -- Tricepsové natažení za hlavou s jednoručkou

UPDATE exercises SET
  name_en = 'Kettlebell Turkish Get-Up', description_en = 'Lie on your back with a kettlebell held above the chest in one hand, the other hand braced on the floor. Progressively rise to a seated position, then to a squat, and finally to an upright standing position, all while keeping the kettlebell overhead. Return the same way back to lying down. Alternate between the left and right hand. The key is to stay focused on the kettlebell and move smoothly without stopping. Keep the core under tension throughout and do not rush - the goal is control and stability, not speed.', setup_instructions_en = '1. Lie on your back, kettlebell in one hand extended perpendicular to the ceiling.
2. Place the other arm and the same-side leg on the floor at 45°.
3. Bend the knee of the other leg.'
WHERE id = 'a6c4f939-f0ff-4fb5-ad06-6fb156487c2b'; -- Turkish get-up s kettlebellem

UPDATE exercises SET
  name_en = 'Kettlebell Lateral Raise', description_en = '1. Stand upright with kettlebells at both sides of the body, palms facing the body.
2. Raise the arms out to the sides with a slight elbow bend until they are parallel to the floor.
3. Pause at the top of the movement.
4. Slowly return the arms to the starting position.', setup_instructions_en = '1. Stand upright with a kettlebell in each hand along the body.
2. Palms facing the body or forward.
3. Stance shoulder-width, back straight.'
WHERE id = 'f3494633-1915-47d4-bd56-ce9420bf3d15'; -- Upažení s kettlebellem

UPDATE exercises SET
  name_en = 'Dumbbell Rear Lateral Raise', description_en = 'The chest-supported reverse fly is one of the best isolation exercises for the posterior deltoid. Lying prone on an incline bench makes it nearly impossible to use momentum or body swing, forcing the posterior shoulders to do maximum work. The exercise also helps improve posture by strengthening the upper back muscles.', setup_instructions_en = '1. Set the bench to 30-45 degrees and lie prone on it.
2. Keep feet firmly on the floor, head extended beyond the top edge of the bench.
3. Grip the dumbbells, let the arms hang vertically downward, palms facing each other with elbows slightly bent.
4. On the exhale, raise the dumbbells in a controlled manner out to the sides (abduct) until the arms are at shoulder level.
5. At the top, pause for a second, then on the inhale slowly lower back down.'
WHERE id = '80977177-1bf0-4e7c-9f98-3200c7165097'; -- Upažení vzad s jednoručkami

UPDATE exercises SET
  name_en = 'Machine Lateral Raise', description_en = 'The selectorized lateral raise machine is one of the best exercises for isolating the medial deltoid head. The fixed movement path and padded arm rests eliminate trapezius engagement and body momentum (cheating), leading to more precise shoulder shaping and width development. Constant tension throughout the range of motion ensures effective muscle fiber stimulation.', setup_instructions_en = '1. Adjust the seat height so your elbows, when resting on the pads, are aligned with the machine''s axis of rotation.
2. Select the weight by inserting the pin into the weight stack.
3. Sit down, grip the handles, and rest the outer portion of the arms (just above the elbows) on the padded supports.
4. On the exhale, smoothly raise the arms to the sides until the elbows are at shoulder level.
5. At the top, briefly pause, then on the inhale lower in a controlled manner back down.'
WHERE id = '15fb048f-0971-4792-a552-5cabafca6c9a'; -- Upažování na stroji

UPDATE exercises SET
  name_en = 'Vertical Chest Press', description_en = '1. Sit on the machine and grip the handles from below.
2. Adjust the machine to achieve the greatest possible range of motion.
3. Press until the elbows are extended, without locking them out.', setup_instructions_en = 'Adjust the seat - handles at mid-chest level. Sit down, back fully against the pad, feet on the floor.'
WHERE id = '149e88cd-3707-4ce0-9354-be4c44599b2f'; -- Vertikální tlak na prsa

UPDATE exercises SET
  name_en = 'Machine Vertical Chest Press', description_en = '1. Sit on the machine and grip the handles with arms from the sides.
2. Adjust the machine to achieve the greatest possible range of motion.
3. Press until the elbows are fully extended, but not hyperextended.', setup_instructions_en = 'Adjust the seat - handles or levers at mid-chest level. Sit down, back fully against the pad.'
WHERE id = '597883e5-135d-47c8-a549-e0e59b1cabdb'; -- Vertikální tlak na prsa na stroji

UPDATE exercises SET
  name_en = 'Rowing', description_en = '1. Sit on the seat, secure the feet, and hold the handle with arms extended.
2. Push through the legs, lean slightly back, and pull the handle to the lower ribs.
3. Extend the arms, lean forward from the hips, bend the knees, and return to the starting position.', setup_instructions_en = 'Sit on the machine, grip the handles or brace the chest against the support. Set the machine to your height. Back upright, lean slightly forward.'
WHERE id = 'f22f9099-6805-4807-9e0e-b261abff5099'; -- Veslování

UPDATE exercises SET
  name_en = 'Smith Machine Lunges', description_en = '1. Stand with feet hip-width apart, bar resting on the shoulders. Feet slightly turned out, shoulders relaxed and pulled back.
2. Take a step back with one foot and lower the body so the front thigh is parallel to the floor and the back knee nearly touches the floor.
3. Push off the back foot and return to the starting position.', setup_instructions_en = 'Set the bar at shoulder height and rest it on the upper back. Unlock the machine. Stand in a stable position ready to step forward.'
WHERE id = 'c96b7b21-875c-4961-a1c8-ce28efdc2a2c'; -- Výpady na Smith stroji

UPDATE exercises SET
  name_en = 'Dumbbell Lunges', description_en = 'Dumbbell lunges are a compound exercise targeting the lower limb and glute muscles. This unilateral exercise (performed on each leg separately) significantly improves stability, balance, and helps correct muscular imbalances. Adding dumbbells increases the grip and trunk stability demands.', setup_instructions_en = '1. Stand upright with feet hip-width apart, holding a dumbbell in each hand at the sides.
2. Take a long step forward with one foot.
3. On the inhale, lower the hips straight down until both knees are at approximately 90 degrees. The back knee should be just above the floor.
4. Keep the torso upright and the front knee should not significantly pass over the toe.
5. On the exhale, return to the starting stance by pressing through the heel of the front foot.'
WHERE id = '70587e27-ad7d-40b2-9662-f17f67a1f44c'; -- Výpady s jednoručkami

UPDATE exercises SET
  name_en = 'Kettlebell Lunges', description_en = '1. Stand with feet hip-width apart, holding a kettlebell in each hand with palms facing each other.
2. Take a large step forward with the right foot and lower the hips until both knees are bent at approximately 90 degrees.
3. Ensure the front knee is directly over the ankle and the back knee just doesn''t touch the floor.
4. Return to the starting position and repeat on the other leg.', setup_instructions_en = '1. Hold a kettlebell in each hand at the sides or one kettlebell in the goblet position at the chest.
2. Stand upright, feet together.'
WHERE id = 'd8f0943f-4586-4eb9-a84a-e92267eaa78a'; -- Výpady s kettlebellem

UPDATE exercises SET
  name_en = 'Sandbag Lunges', description_en = '1. Stand with feet hip-width apart, holding a dumbbell in each hand with palms facing each other.
2. Take a large step forward with the right foot and lower the hips so the right thigh is parallel to the floor and the left knee is just above the floor.
3. Press through the right heel to straighten the right leg and return to the starting position.', setup_instructions_en = 'Hold the bag with both hands or rest it on the shoulders. Stand upright, feet shoulder-width apart. Gaze forward, shoulders pulled back.'
WHERE id = 'd836bda9-119c-456e-a0f4-48a63ff01c16'; -- Výpady s pytlem

UPDATE exercises SET
  name_en = 'Rack Lunges', description_en = 'Barbell lunges in a rack are a compound exercise targeting quadriceps, glutes, and hamstrings. Performing in the rack provides a safe setup and re-racking point and helps maintain stability during the movement. The exercise is ideal for eliminating muscular imbalances and building functional leg strength.', setup_instructions_en = '1. Set the barbell in the rack to shoulder height.
2. Step under the bar, rest it on the shoulders (trapezius), and brace the core.
3. Unrack the bar by straightening the legs and step back to a stable position.
4. Take a controlled step forward (or backward) and lower the hips until both knees are at approximately 90 degrees.
5. On the exhale, return to the starting position by pushing off the front foot, then alternate legs.'
WHERE id = '0400f623-dc19-4fb9-b8f3-1adf435864a3'; -- Výpady v rámu

UPDATE exercises SET
  name_en = 'Seated Calf Raises', description_en = '1. Sit on the machine, place the front of the feet on the platform, and secure the thighs under the padded support.
2. Release the safety lock and on the inhale slowly lower the heels as far below platform level as possible to stretch the calf muscles.
3. On the exhale, dynamically rise onto the toes as high as possible and at the top briefly squeeze the calves hard.
4. Return to the starting position in a controlled manner and repeat.', setup_instructions_en = '1. Adjust the thigh support height so it holds you firmly but allows full range of motion at the ankles.
2. Select an appropriate weight that allows technically correct performance throughout the full range of motion.'
WHERE id = '0efc90b1-7c3c-4cce-b39d-c6f3e6d28146'; -- Výpony na lýtka vsedě

UPDATE exercises SET
  name_en = 'Box Jump', description_en = 'The box jump is an explosive plyometric exercise developing lower limb power and speed. It engages the quadriceps, hamstrings, glutes, and calves. It improves athletic performance, coordination, and burns a high number of calories.', setup_instructions_en = '1. Stand facing the box, feet hip-width apart, approximately 30 cm from the box.
2. Slightly bend the knees and prepare for the jump.
3. Powerfully push off with both feet, using arm swing to assist the jump.
4. Land softly on the center of the box on the balls of the feet, knees slightly bent.
5. Stand upright on the box, then step back down in a controlled manner.'
WHERE id = 'df871e0f-9fc2-4ae3-a10e-5a2ed70f5e49'; -- Výskok na box

UPDATE exercises SET
  name_en = 'Box Step-Up', description_en = 'The box step-up is a functional strength exercise focused on unilateral lower limb strengthening. It engages the quadriceps, hamstrings, and glutes. It improves balance, stability, and strength symmetry between the left and right legs.', setup_instructions_en = '1. Stand facing the box, feet hip-width apart.
2. Place one foot fully on the center of the box.
3. Transfer weight onto the front foot and press the body up into a standing position on the box.
4. Bring the other foot alongside - or leave it hanging for a harder variation.
5. Step back down in a controlled manner and repeat on the other side.'
WHERE id = '06fbb451-e90a-4602-8902-701a0c5d62bb'; -- Výstup na box

UPDATE exercises SET
  name_en = 'Windmill', description_en = '1. Hold the implement in one hand and raise the arm overhead.
2. Turn one foot out to the side and point the other foot forward.
3. Tilt to the side and reach toward the foot.', setup_instructions_en = 'Stand slightly wider than shoulder-width, toes rotated 45° away from the hand holding the kettlebell or dumbbell. Raise the implement over the shoulder in one hand.'
WHERE id = '8a225012-35dc-41ee-abf2-b1ce7be8132d'; -- Větrný mlýn

UPDATE exercises SET
  name_en = 'Kettlebell Windmill', description_en = '1. Stand with a wider than shoulder-width stance. Take a kettlebell in one hand and extend the arm overhead.
2. With the body upright and the kettlebell above the head, lower the other hand toward the floor while rotating toward the kettlebell side.
3. Return to the starting position, slightly thrust the hips forward, and repeat.', setup_instructions_en = '1. Stand slightly wider than shoulder-width, toes rotated 45° away from the kettlebell hand.
2. Extend the kettlebell overhead in one arm.'
WHERE id = '96def0dc-6dc4-4d4b-a278-36c303749461'; -- Větrný mlýn s kettlebellem

UPDATE exercises SET
  name_en = 'Wall Ball', description_en = '1. Hold the medicine ball at the chest and stand facing the wall.
2. Squat down, then throw the ball at the wall.
3. Catch the ball and repeat for the required number of repetitions.', setup_instructions_en = 'Stand approximately one meter from the wall. Hold the medicine ball with both hands at the chest, elbows in. Feet shoulder-width apart, toes slightly out.'
WHERE id = 'fc5916fe-d584-4fd9-b4ba-eca07ca0a1ec'; -- Wall ball

UPDATE exercises SET
  name_en = 'Y Raise', description_en = 'The Y-raise on an incline bench is a specialized exercise targeting the lower scapular fixators and posterior deltoids. The chest support ensures strict technique without trunk assistance. The Y-shaped movement path optimally engages the muscles responsible for proper scapular positioning and healthy shoulder joint mechanics.', setup_instructions_en = '1. Set the bench to approximately 30-45 degrees and lie prone on it.
2. Hold a light dumbbell in each hand, let the arms hang vertically downward, palms facing each other (thumbs up).
3. On the exhale, raise the arms diagonally forward so the body and arms form the letter ''Y'' from above.
4. At the top, when the arms are in line with the torso, pause for a second and consciously press the shoulder blades downward.
5. On the inhale, slowly lower the dumbbells back to the starting position.'
WHERE id = '5b314881-6a48-4501-92c6-f3a814041845'; -- Y zdvih

UPDATE exercises SET
  name_en = 'Lying Leg Curl', description_en = '1. Lie on the machine face down and hook the heels under the padded roller.
2. Grip the handles to stabilize the torso and ensure the knees are in line with the machine''s axis of rotation.
3. On the exhale, smoothly curl the roller toward the glutes using the hamstrings.
4. At the top, pause briefly and on the inhale slowly return the legs to the starting position.', setup_instructions_en = '1. Adjust the roller position so it rests against the lower calves just above the heels.
2. Adjust the machine length so your knees extend just beyond the edge of the pad.'
WHERE id = 'a6805a15-1a00-4a0b-a32e-05de8b846e06'; -- Zakopávání vleže

UPDATE exercises SET
  name_en = 'Hanging Knee Raise', description_en = '1. Grip the bar and hang with the body upright and legs extended.
2. Slowly pull the knees toward the chest.
3. Once the knees are raised as high as possible, lower the legs and repeat. Perform movements slowly to avoid using momentum and get maximum benefit from the exercise.
4. Perform movements slowly to avoid using momentum and get maximum benefit from the exercise.', setup_instructions_en = 'Grip the bar overhand at shoulder-width or slightly wider. Hang in a dead hang with arms fully extended. Prevent swinging - stabilize briefly.'
WHERE id = '453657da-730a-45a9-91de-27c01171ef95'; -- Zdvih kolen ve visu

UPDATE exercises SET
  name_en = 'Parallel Bar Hanging Knee Raise', description_en = '1. Stand in the machine, brace the forearms on the padded supports, and grip the handles firmly.
2. Keep the back firmly pressed against the pad and push the shoulders down (do not shrug).
3. On the exhale, raise the knees in a controlled manner toward the chest until the thighs are parallel to the floor or above.
4. On the inhale, slowly lower the legs back to the starting position without swinging the hips.', setup_instructions_en = '1. Ensure the forearms are stably positioned on the padding and the body hangs freely.
2. Brace the core before initiating the movement.'
WHERE id = 'e9350874-9608-4210-9c32-050aceff9fc9'; -- Zdvih kolen ve visu na bradlech

UPDATE exercises SET
  name_en = 'Pull-Up Bar Hanging Knee Raise', description_en = 'Hanging knee raises are a highly effective core exercise, particularly for the lower abdominals. Hanging from the bar eliminates back support, requiring engagement of the deep stabilizing system. This exercise is ideal for building abdominal strength while also improving grip strength and shoulder stability.', setup_instructions_en = '1. Hang from the bar overhand, arms fully extended.
2. Brace the core and avoid swinging.
3. On the exhale, smoothly pull the knees toward the chest until the thighs are at least horizontal.
4. At the top, squeeze the abdomen for one second.
5. On the inhale, lower the legs in a controlled manner back to the starting position.'
WHERE id = '8c43ab4c-6dcf-46dd-a9d6-15b7c71a5a05'; -- Zdvih kolen ve visu na hrazdě

UPDATE exercises SET
  name_en = 'Standing Calf Raise', description_en = '1. Hold both handles and stand upright.
2. Raise the heels as high as possible and lower in a controlled manner.', setup_instructions_en = 'Set up the machine so you can brace against the shoulder pad while also achieving full stretch at the bottom.'
WHERE id = 'c6a0be8e-2045-430b-bc3f-893f34cc9be2'; -- Zdvih lýtek vstoje

UPDATE exercises SET
  name_en = 'Hanging Leg Raise', description_en = '1. Grip the bar and hang with the body still and legs extended.
2. Slowly pull the knees toward the chest.
3. Once the knees are raised as high as possible, lower the legs and repeat. Perform movements slowly to avoid using momentum and maximize the benefit from the exercise.
4. Perform movements slowly to avoid using momentum and maximize the benefit from the exercise.', setup_instructions_en = 'Grip the bar overhand at shoulder-width or slightly wider. Hang in a dead hang with arms fully extended. Legs extended downward, body stable.'
WHERE id = '6c926fd1-d9ca-4791-a106-a91e38466dbb'; -- Zdvih nohou ve visu

UPDATE exercises SET
  name_en = 'Hanging Leg Raise (90°)', description_en = 'The hanging straight-leg raise to hip level is an advanced abdominal exercise requiring a high degree of control and stability. Unlike the knee raise, extended legs create much greater resistance for the abdominal muscles. The exercise targets functional core strength and improves muscle definition of the lower abdomen.', setup_instructions_en = '1. Hang from the bar overhand at shoulder-width, arms fully extended.
2. Brace the core and keep legs together, knees extended.
3. On the exhale, smoothly raise the straight legs in front of you until they form a 90-degree angle with the torso (parallel to the floor).
4. At the top, hold for a second and on the inhale lower the legs in a controlled manner back down.'
WHERE id = 'adf6fe88-b927-45a7-8691-c76a6553afe6'; -- Zdvih nohou ve visu (90°)

UPDATE exercises SET
  name_en = 'Toes-to-Bar', description_en = 'The hanging toes-to-bar (often referred to as Toes-to-Bar or T2B) is an advanced and highly effective exercise for strengthening the entire core, with particular emphasis on the lower rectus abdominis. Unlike the knee raise, this exercise in its full range of motion also requires significant hip flexor and grip strength. It is a complex movement that tests both strength and gymnastic skill.', setup_instructions_en = '1. Hang from the bar overhand at shoulder-width. Arms are extended, body in a neutral position ("hollow body" position).
2. Brace the core and on the exhale smoothly raise the straight legs in an arc upward until the toes touch the bar between the hands.
3. At the top, briefly squeeze the abdomen.
4. On the inhale, lower the legs in a controlled and slow manner back to the starting position without swinging.'
WHERE id = 'da25ce72-df05-4541-810c-2e9018b76a86'; -- Zvedání nohou k hrazdě (Toes-to-Bar)

UPDATE exercises SET
  name_en = 'Leg Abduction', description_en = '1. Adjust the machine to your height. Sit with a straight back against the pad, legs together.
2. Slowly push the legs apart against the resistance. Pause briefly at the top.
3. Slowly return the legs to the starting position and repeat.', setup_instructions_en = 'Set the machine so the knees are approximately at a right angle and the pads slightly above the knees. Set the range of motion according to your mobility so the movement is full but still controlled.'
WHERE id = 'aec8f23c-a765-45b1-8c33-0abd399860ec'; -- Únos

UPDATE exercises SET
  name_en = 'Hip Abduction', description_en = '1. Adjust the machine to your height. Sit with the back firmly pressed against the pad, legs together.
2. Slowly spread the legs against the resistance. Pause at the end position.
3. Slowly return the legs to the starting position. Repeat for the required number of repetitions.', setup_instructions_en = 'Set the inner pads to knee height. Sit upright, back fully against the pad. Legs together in the starting position.'
WHERE id = '274bbd1b-6e7b-49a7-89ac-b1958cd0f993'; -- Únos kyčle

UPDATE exercises SET
  name_en = 'Incline Bench Press', description_en = '1. Set the bench at a 30 to 45 degree angle.
2. Lie on the bench with feet on the floor. Take the bar from the rack with arms extended.
3. Lower the bar to the upper chest.
4. Press the bar up (slowly and in a controlled manner) until the elbows are fully extended.', setup_instructions_en = 'Set the bench at 30-45°. Lie down, feet firmly on the floor. Set the safety catches. Grip the bar slightly wider than shoulder-width.'
WHERE id = '4a5c91f3-523c-453f-bb89-cf018ee0f91b'; -- Šikmý bench press

UPDATE exercises SET
  name_en = 'Smith Machine Incline Bench Press', description_en = '1. Set the bench to 30 to 45 degrees.
2. Lie on the bench with feet on the floor. With arms extended, unrack the bar from the lock.
3. Lower the bar to the upper chest.
4. Press the bar up (slowly and in a controlled manner) until the elbows are fully extended.', setup_instructions_en = 'Set the incline bench (30-45°) under the Smith machine. Lie down, feet on the floor. Set the bar and catches. Grip the bar at shoulder-width.'
WHERE id = '86df0769-b175-46d7-8bbd-05465adbe62d'; -- Šikmý bench press na Smith stroji

UPDATE exercises SET
  name_en = 'Rack Incline Bench Press', description_en = 'The incline bench press in a rack is a key exercise for developing the upper pectorals and front deltoids. Using the rack allows precise hook height and safety stop adjustment, increasing confidence when training with heavier loads without a spotter. The stable rack structure provides safe re-racking of the bar at any point in the set.', setup_instructions_en = '1. Position the bench in the rack and set the incline to 30-45 degrees.
2. Set the hook height so you can comfortably reach the bar with arms slightly bent.
3. Lie on the bench, grip the bar overhand slightly wider than shoulder-width and unrack it.
4. On the inhale, lower the bar in a controlled manner to the upper chest.
5. On the exhale, press the bar smoothly upward to nearly full elbow extension.'
WHERE id = '2a32e6f5-8698-4ee4-8692-e1729ea87837'; -- Šikmý bench press v rámu

UPDATE exercises SET
  name_en = 'Incline Chest Press', description_en = '1. Adjust the seat to your height.
2. Press the weight forward until your elbows are nearly extended. Return to the starting position without letting the weight rest at the bottom until you finish the set.', setup_instructions_en = 'Adjust the seat - handles slightly below shoulder line. Sit down, back fully against the pad, feet on the floor. Grip the handles with elbows slightly lower than the shoulders.'
WHERE id = '3a77ede6-24ea-4f9a-ab6e-ca27d7c21bd6'; -- Šikmý tlak na prsa

UPDATE exercises SET
  name_en = 'Selectorized Incline Chest Press', description_en = '1. Adjust the seat to your height.
2. Press the weight forward until your elbows are nearly extended. Return to the starting position without letting the weight rest at the bottom until the set is finished.', setup_instructions_en = 'Adjust the seat and backrest angle. Back fully against the pad, grip handles at chest level or slightly below.'
WHERE id = '7bae9507-762e-4e75-bacd-fee9889bbb8d'; -- Šikmý tlak na prsa výběr

UPDATE exercises SET
  name_en = 'Incline Dumbbell Press', description_en = 'The incline dumbbell press is a key exercise for developing the upper pectoralis major and overall chest fullness. Using dumbbells on an incline bench (typically 30-45 degrees) achieves a greater range of motion and better pectoral isolation than a barbell. The exercise also significantly engages the anterior deltoids and triceps as stabilizing and assisting muscles.', setup_instructions_en = '1. Set the bench to 30-45 degrees and lie face up, feet firmly on the floor.
2. Raise the dumbbells above the chest with arms extended, palms facing forward.
3. On the inhale, slowly lower the dumbbells to the outer upper chest.
4. Keep the elbows nearly perpendicular to the body (at approximately 45-70 degrees from the torso) to avoid overloading the shoulders.
5. On the exhale, press the dumbbells back up to the starting position until the arms are nearly extended.'
WHERE id = '591ad027-19a3-41a0-81cd-df58c16694ef'; -- Šikmý tlak s jednoručkami

COMMIT;