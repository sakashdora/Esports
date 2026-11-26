import { ACADEMY_NAME } from './academy';
import type { ExtraCategoryCode } from './odishaCollegesExtra';

/**
 * Searchable list of Odisha institutions for the registration college picker.
 *
 * Two layers:
 * - ROWS below: hand-checked universities, engineering, MBA/MCA, degree, +2, medical,
 *   pharmacy and law institutions plus CBSE/ICSE schools (Wikipedia's "List of institutions
 *   of higher education in Odisha" and well-known colleges). Always loaded.
 * - odishaCollegesExtra.ts: about 1,700 more, generated from CHSE Odisha's district lists of
 *   affiliated +2 colleges and the BPUT and Sambalpur University affiliated-college lists.
 *   Loaded with loadAllColleges() when a student opens the college box.
 * Neither is guaranteed complete, so the picker always accepts a typed name too.
 */

export type CollegeCategory =
  | 'University'
  | 'Engineering'
  | 'Management (MBA/MCA)'
  | 'Degree College'
  | '+2 Higher Secondary'
  | 'School (+2)'
  | 'Medical & Health'
  | 'Pharmacy'
  | 'Law'
  | 'Other';

export interface CollegeOption {
  /** Text saved in the form when this option is picked. */
  value: string;
  name: string;
  city: string;
  category: CollegeCategory;
  /** Picking this fills "Name, " and lets the student type their branch or city. */
  needsBranch: boolean;
  /** Lowercase text the search runs against. */
  haystack: string;
  /** Normalized name and short forms, used to rank matches. */
  nameKey: string;
  aliasKey: string;
}

type Row = [name: string, city: string, category: CollegeCategory, aliases?: string];

const U: CollegeCategory = 'University';
const E: CollegeCategory = 'Engineering';
const M: CollegeCategory = 'Management (MBA/MCA)';
const D: CollegeCategory = 'Degree College';
const H: CollegeCategory = '+2 Higher Secondary';
const S: CollegeCategory = 'School (+2)';
const MED: CollegeCategory = 'Medical & Health';
const P: CollegeCategory = 'Pharmacy';
const L: CollegeCategory = 'Law';
const O: CollegeCategory = 'Other';

const ROWS: Row[] = [
  // Host institution first so it shows at the top of an empty search.
  [ACADEMY_NAME, 'Bhubaneswar', M, 'samt srusti academy mba mca bba bca'],
  ['Srusti Academy of Graduate Studies (SAGS)', 'Bhubaneswar', D, 'sags srusti academy graduate bba bca bcom bsc ba plus three'],

  // Private colleges added on request (management, degree and technical)
  ['United School of Business Management (USBM)', 'Bhubaneswar', M, 'usbm united business mba bba'],
  ['DAV School of Business Management', 'Bhubaneswar', M, 'dav sbm mba bba'],
  ['NIIS Institute of Business Administration', 'Bhubaneswar', M, 'niis mba bba'],
  ['Madhusudan Institute of Co-operative Management (MICM)', 'Bhubaneswar', M, 'micm cooperative mba'],
  ['Dr. Ambedkar Memorial Institute of IT and Management Science (DAMITS)', 'Rourkela', M, 'damits ambedkar mba mca bba bca'],
  ['Regional Institute of Education (RIE)', 'Bhubaneswar', D, 'rie ncert bed bsc bed ba bed'],
  ['College of Basic Science and Humanities, OUAT', 'Bhubaneswar', D, 'cbsh ouat bsc'],
  ['Saraswati Degree Vidya Mandir', 'Berhampur', D, 'sdvm saraswati'],
  ['KIIT Polytechnic', 'Bhubaneswar', E, 'kiit polytechnic diploma'],
  ['Sophitorium Group of Institutions', 'Jatni', E, 'sophitorium btech diploma'],
  ['Gandhi Academy of Technology and Engineering (GATE)', 'Berhampur', E, 'gate gandhi btech'],

  // Institutes of national importance and central universities
  ['Indian Institute of Technology Bhubaneswar', 'Bhubaneswar', E, 'iit iitbbs btech'],
  ['National Institute of Technology Rourkela', 'Rourkela', E, 'nit nitr btech mca mba'],
  ['Indian Institute of Management Sambalpur', 'Sambalpur', M, 'iim mba'],
  ['All India Institute of Medical Sciences (AIIMS) Bhubaneswar', 'Bhubaneswar', MED, 'aiims mbbs nursing'],
  ['National Institute of Science Education and Research (NISER)', 'Bhubaneswar', U, 'niser jatni bsc msc'],
  ['Indian Institute of Science Education and Research (IISER) Berhampur', 'Berhampur', U, 'iiser brahmapur bs ms'],
  ['Central University of Odisha', 'Koraput', U, 'cuo central university'],
  ['Central Sanskrit University, Shri Sadashiv Campus', 'Puri', U, 'sanskrit'],

  // State universities
  ['Utkal University', 'Bhubaneswar', U, 'vani vihar vanivihar mba mca msc ma'],
  ['Ravenshaw University', 'Cuttack', U, 'ravenshaw college ba bsc bcom'],
  ['Sambalpur University', 'Burla', U, 'jyoti vihar mba mca'],
  ['Berhampur University', 'Berhampur', U, 'bhanja bihar brahmapur mba mca'],
  ['Fakir Mohan University', 'Balasore', U, 'fmu vyasa vihar mba'],
  ['Maharaja Sriram Chandra Bhanja Deo University', 'Baripada', U, 'north orissa university nou msbu mba'],
  ['Gangadhar Meher University', 'Sambalpur', U, 'gmu'],
  ['Rama Devi Women\'s University', 'Bhubaneswar', U, 'ramadevi women college'],
  ['Khallikote Unitary University', 'Berhampur', U, 'khallikote college brahmapur'],
  ['Rajendra University', 'Balangir', U, 'rajendra college bolangir'],
  ['Maa Manikeshwari University (Kalahandi University)', 'Bhawanipatna', U, 'kalahandi'],
  ['Vikram Dev University', 'Jeypore', U, 'vikram deb college koraput'],
  ['Dharanidhar University', 'Keonjhar', U, 'dharanidhar college kendujhar'],
  ['Odia University', 'Satyabadi', U, 'odia'],
  ['Odisha State Open University', 'Sambalpur', U, 'osou distance'],
  ['Utkal University of Culture', 'Bhubaneswar', U, 'culture'],
  ['Shree Jagannath Sanskrit University', 'Puri', U, 'sanskrit vishwavidyalaya'],
  ['Odisha University of Agriculture and Technology (OUAT)', 'Bhubaneswar', U, 'ouat agriculture bsc ag'],
  ['Biju Patnaik University of Technology (BPUT)', 'Rourkela', U, 'bput btech mba mca'],
  ['Odisha University of Technology and Research (OUTR), formerly CET', 'Bhubaneswar', E, 'outr cet college of engineering and technology btech mca'],
  ['Veer Surendra Sai University of Technology (VSSUT)', 'Burla', E, 'vssut uce burla btech mca'],
  ['Odisha University of Health Sciences', 'Bhubaneswar', MED, 'ouhs'],
  ['Madhusudan Law University', 'Cuttack', L, 'mlu madhusudan law college llb'],
  ['National Law University Odisha', 'Cuttack', L, 'nluo llb ba llb'],
  ['International Institute of Information Technology (IIIT) Bhubaneswar', 'Bhubaneswar', E, 'iiit iiit-bh btech'],

  // Deemed and private universities
  ['Kalinga Institute of Industrial Technology (KIIT University)', 'Bhubaneswar', U, 'kiit ksom ksca kims kids btech mba mca bba bca'],
  ['KIIT School of Management (KSOM)', 'Bhubaneswar', M, 'kiit ksom mba'],
  ['Kalinga Institute of Social Sciences (KISS)', 'Bhubaneswar', U, 'kiss'],
  ['Siksha \'O\' Anusandhan University (SOA)', 'Bhubaneswar', U, 'soa iter ibcs ims sum btech mba mca bba bca'],
  ['Institute of Technical Education and Research (ITER), SOA', 'Bhubaneswar', E, 'iter soa btech'],
  ['Institute of Business and Computer Studies (IBCS), SOA', 'Bhubaneswar', M, 'ibcs soa mba mca bba bca'],
  ['Indian Institute of Mass Communication (IIMC)', 'Dhenkanal', O, 'iimc journalism'],
  ['Centurion University of Technology and Management', 'Bhubaneswar', U, 'cutm centurion paralakhemundi btech mba'],
  ['C. V. Raman Global University', 'Bhubaneswar', U, 'cgu cv raman cvrce btech mba mca'],
  ['Sri Sri University', 'Cuttack', U, 'ssu sri sri mba bba'],
  ['XIM University', 'Bhubaneswar', U, 'xim xavier mba'],
  ['Xavier Institute of Management Bhubaneswar (XIMB)', 'Bhubaneswar', M, 'ximb xavier mba'],
  ['GIET University', 'Gunupur', U, 'giet gandhi institute of engineering and technology btech mba mca'],
  ['Birla Global University', 'Bhubaneswar', U, 'bgu birla mba bba'],
  ['ASBM University', 'Bhubaneswar', U, 'asbm asian school of business management mba bba'],
  ['DRIEMS University', 'Cuttack', U, 'driems tangi dhaneswar rath btech mba'],
  ['Jagadguru Kripalu University', 'Cuttack', U, 'jku kripalu'],
  ['NIST University (National Institute of Science and Technology)', 'Berhampur', U, 'nist btech mba'],
  ['Silicon University (Silicon Institute of Technology)', 'Bhubaneswar', E, 'silicon sit btech mca'],
  ['Silicon Institute of Technology, Sambalpur', 'Sambalpur', E, 'silicon sit btech'],
  ['AIPH University', 'Bhubaneswar', U, 'aiph public health'],

  // Engineering colleges
  ['Indira Gandhi Institute of Technology (IGIT), Sarang', 'Dhenkanal', E, 'igit sarang btech'],
  ['Parala Maharaja Engineering College (PMEC)', 'Berhampur', E, 'pmec btech'],
  ['Government College of Engineering, Keonjhar', 'Keonjhar', E, 'gcek btech'],
  ['Government College of Engineering, Kalahandi', 'Bhawanipatna', E, 'gcekbpatna btech'],
  ['Utkalmani Gopabandhu Institute of Engineering (UGIE)', 'Rourkela', E, 'ugie'],
  ['Sambalpur University Institute of Information Technology (SUIIT)', 'Burla', E, 'suiit btech mca'],
  ['Central Institute of Petrochemicals Engineering and Technology (CIPET)', 'Bhubaneswar', E, 'cipet plastic'],
  ['Institute of Chemical Technology (ICT-IOC)', 'Bhubaneswar', E, 'ict ioc chemical'],
  ['Gandhi Institute for Technological Advancement (GITA)', 'Bhubaneswar', E, 'gita autonomous btech mba mca'],
  ['Trident Academy of Technology', 'Bhubaneswar', E, 'tat trident btech mba mca'],
  ['Gandhi Institute for Technology (GIFT)', 'Bhubaneswar', E, 'gift btech mba'],
  ['Gandhi Institute for Education and Technology (GIET Ghangapatna)', 'Bhubaneswar', E, 'giet ghangapatna btech'],
  ['Gandhi Engineering College (GEC)', 'Bhubaneswar', E, 'gec btech mba'],
  ['Orissa Engineering College (OEC)', 'Bhubaneswar', E, 'oec btech mba'],
  ['College of Engineering Bhubaneswar (CEB)', 'Bhubaneswar', E, 'ceb btech mba mca'],
  ['Konark Institute of Science and Technology (KIST)', 'Bhubaneswar', E, 'kist btech'],
  ['Krupajal Engineering College', 'Bhubaneswar', E, 'kec krupajal btech mba'],
  ['Aryan Institute of Engineering and Technology', 'Bhubaneswar', E, 'aiet aryan btech'],
  ['Eastern Academy of Science and Technology (EAST)', 'Bhubaneswar', E, 'east btech'],
  ['Einstein Academy of Technology and Management (EATM)', 'Bhubaneswar', E, 'eatm btech'],
  ['NM Institute of Engineering and Technology', 'Bhubaneswar', E, 'nmiet btech'],
  ['Nalanda Institute of Technology', 'Bhubaneswar', E, 'nit nalanda btech'],
  ['Hi-Tech Institute of Technology', 'Bhubaneswar', E, 'hitech btech'],
  ['Hi-Tech College of Engineering', 'Bhubaneswar', E, 'hitech btech'],
  ['Bhubaneswar Engineering College (BEC)', 'Bhubaneswar', E, 'bec btech'],
  ['Raajdhani Engineering College', 'Bhubaneswar', E, 'rec rajdhani btech'],
  ['Templecity Institute of Technology and Engineering (TITE)', 'Bhubaneswar', E, 'tite btech'],
  ['Capital Engineering College', 'Bhubaneswar', E, 'cec btech'],
  ['Apex Institute of Technology and Management', 'Bhubaneswar', E, 'aitm apex btech'],
  ['Vedang Institute of Technology', 'Bhubaneswar', E, 'vit vedang btech'],
  ['Suddhananda Engineering and Research Centre', 'Bhubaneswar', E, 'serc btech'],
  ['Barrister Ranjit Mohanty International Institute of Technology (BRMIIT)', 'Bhubaneswar', E, 'brm brmiit btech'],
  ['KMBB College of Engineering and Technology', 'Bhubaneswar', E, 'kmbb btech'],
  ['Indus College of Engineering', 'Bhubaneswar', E, 'indus btech'],
  ['Mahavir Institute of Engineering and Technology', 'Bhubaneswar', E, 'miet btech'],
  ['Modern Institute of Technology and Management (MITM)', 'Bhubaneswar', E, 'mitm mit btech mba'],
  ['Maharaja Institute of Technology (MIT)', 'Bhubaneswar', E, 'mit maharaja taraboi btech'],
  ['Ajay Binay Institute of Technology (ABIT)', 'Cuttack', E, 'abit btech mba mca'],
  ['Ghanashyam Hemalata Institute of Technology and Management (GHITM)', 'Puri', E, 'ghitm btech'],
  ['Synergy Institute of Engineering and Technology (SIET)', 'Dhenkanal', E, 'siet synergy btech'],
  ['Padmanava College of Engineering', 'Rourkela', E, 'pce btech'],
  ['Purushottam Institute of Engineering and Technology (PIET)', 'Rourkela', E, 'piet btech'],
  ['Balasore College of Engineering and Technology (BCET)', 'Balasore', E, 'bcet btech'],
  ['Modern Engineering and Management Studies (MEMS)', 'Balasore', E, 'mems btech'],
  ['Bhadrak Institute of Engineering and Technology (BIET)', 'Bhadrak', E, 'biet btech'],
  ['Seemanta Engineering College', 'Jharpokharia, Mayurbhanj', E, 'sec btech'],
  ['Black Diamond College of Engineering and Technology', 'Jharsuguda', E, 'bdcet btech'],
  ['Roland Institute of Technology', 'Berhampur', E, 'rit roland btech'],
  ['Sanjay Memorial Institute of Technology (SMIT)', 'Berhampur', E, 'smit btech'],
  ['Kalam Institute of Technology', 'Berhampur', E, 'kit kalam btech'],
  ['Vignan Institute of Technology and Management (VITAM)', 'Berhampur', E, 'vitam btech'],
  ['Majhighariani Institute of Technology and Science (MITS)', 'Rayagada', E, 'mits btech'],
  ['Gandhi Institute of Science and Technology (GIST)', 'Rayagada', E, 'gist btech'],
  ['Gandhi Institute of Advanced Computer and Research (GIACR)', 'Rayagada', E, 'giacr mca'],
  ['Gopal Krushna College of Engineering and Technology', 'Jeypore', E, 'gkcet btech'],
  ['Orissa School of Mining Engineering (OSME)', 'Keonjhar', E, 'osme mining diploma'],

  // Management, MBA and MCA
  ['Biju Patnaik Institute of IT and Management Studies (BIITM)', 'Bhubaneswar', M, 'biitm mba mca'],
  ['Regional College of Management (RCM)', 'Bhubaneswar', M, 'rcm mba mca'],
  ['Institute of Management and Information Technology (IMIT)', 'Cuttack', M, 'imit mba mca'],
  ['Institute of Management and Information Science (IMIS)', 'Bhubaneswar', M, 'imis mba mca'],
  ['College of IT and Management Education (CIME)', 'Bhubaneswar', M, 'cime mba mca'],
  ['Interscience Institute of Management and Technology (IIMT)', 'Bhubaneswar', M, 'iimt mba mca'],
  ['Institute of Professional Studies and Research (IPSAR)', 'Cuttack', M, 'ipsar mba mca'],
  ['Centre for IT Education (CITE)', 'Bhubaneswar', M, 'cite mca mba'],
  ['IMI Bhubaneswar (International Management Institute)', 'Bhubaneswar', M, 'imi mba'],
  ['Affinity Business School', 'Bhubaneswar', M, 'affinity mba'],
  ['Rourkela Institute of Management Studies (RIMS)', 'Rourkela', M, 'rims mba mca'],
  ['Asian Workers Development Institute (AWDI)', 'Rourkela', M, 'awdi mba'],
  ['IIPM School of Management', 'Rourkela', M, 'iipm mba'],
  ['Indian Institute for Production Management (IIPM)', 'Kansbahal', M, 'iipm kansbahal mba'],
  ['Academy of Business Administration (ABA)', 'Balasore', M, 'aba mba'],
  ['Indian Institute of Tourism and Travel Management (IITTM)', 'Bhubaneswar', M, 'iittm bba mba tourism'],
  ['Institute of Hotel Management (IHM)', 'Bhubaneswar', O, 'ihm hotel management catering'],
  ['National Institute of Fashion Technology (NIFT)', 'Bhubaneswar', O, 'nift fashion design'],
  ['Indian Institute of Handloom Technology', 'Bargarh', O, 'iiht handloom'],

  // Degree (+3) and autonomous colleges
  ['BJB Autonomous College', 'Bhubaneswar', D, 'bjb buxi jagabandhu ba bsc bcom'],
  ['Rajdhani College', 'Bhubaneswar', D, 'rajdhani ba bsc bcom plus two'],
  ['Biju Patnaik College of Science and Education', 'Bhubaneswar', D, 'bpcse'],
  ['Ekamra College', 'Bhubaneswar', D, 'ekamra'],
  ['Maharshi College of Natural Law', 'Bhubaneswar', D, 'maharshi plus two'],
  ['Prananath Autonomous College', 'Khordha', D, 'prananath khurda plus two'],
  ['Jatni College', 'Jatni', D, 'jatni'],
  ['Shailabala Women\'s Autonomous College', 'Cuttack', D, 'sailabala women plus two'],
  ['Christ College', 'Cuttack', D, 'christ plus two'],
  ['Stewart Science College', 'Cuttack', D, 'stewart plus two'],
  ['Udayanath Autonomous College of Science and Technology', 'Adaspur, Cuttack', D, 'udayanath'],
  ['Banki Autonomous College', 'Banki', D, 'banki plus two'],
  ['Salipur Autonomous College', 'Salipur', D, 'salipur plus two'],
  ['Choudwar College', 'Choudwar', D, 'choudwar'],
  ['S.V.M. Autonomous College', 'Jagatsinghpur', D, 'svm plus two'],
  ['Paradip College', 'Paradip', D, 'paradeep'],
  ['Samanta Chandra Sekhar (SCS) Autonomous College', 'Puri', D, 'scs plus two'],
  ['Nimapara Autonomous College', 'Nimapara', D, 'nimapada plus two'],
  ['Nayagarh Autonomous College', 'Nayagarh', D, 'nayagarh plus two'],
  ['Kendrapara Autonomous College', 'Kendrapara', D, 'kendrapara plus two'],
  ['Pattamundai College', 'Pattamundai', D, 'pattamundai'],
  ['N.C. Autonomous College', 'Jajpur', D, 'nc narasingha choudhury plus two'],
  ['Vyasanagar Autonomous College', 'Jajpur Road', D, 'byasanagar vyasanagar'],
  ['Baba Bhairabananda Mahavidyalaya', 'Chandikhol', D, 'bbm'],
  ['Dhenkanal Autonomous College', 'Dhenkanal', D, 'dhenkanal plus two'],
  ['Kamakhyanagar College', 'Kamakhyanagar', D, 'kamakhyanagar'],
  ['Government Autonomous College, Angul', 'Angul', D, 'angul plus two'],
  ['Talcher Autonomous College', 'Talcher', D, 'talcher plus two'],
  ['Fakir Mohan Autonomous College', 'Balasore', D, 'fm college plus two'],
  ['Kuntala Kumari Sabat Women\'s College', 'Balasore', D, 'kks women'],
  ['Bhadrak Autonomous College', 'Bhadrak', D, 'bhadrak plus two'],
  ['Maharaja Purna Chandra (MPC) Autonomous College', 'Baripada', D, 'mpc plus two'],
  ['Karanjia College', 'Karanjia', D, 'karanjia'],
  ['Rairangpur College', 'Rairangpur', D, 'rairangpur'],
  ['Anandapur College', 'Anandapur', D, 'anandapur'],
  ['Government Autonomous College, Rourkela', 'Rourkela', D, 'gac rourkela plus two'],
  ['Ispat Autonomous College', 'Rourkela', D, 'ispat'],
  ['Sushilavati Government Women\'s College', 'Rourkela', D, 'sgwc women'],
  ['Government Women\'s College, Sambalpur', 'Sambalpur', D, 'women'],
  ['Laxmi Narayan College', 'Jharsuguda', D, 'ln college'],
  ['Panchayat College', 'Bargarh', D, 'panchayat'],
  ['DAV College, Titilagarh', 'Titilagarh', D, 'dav titlagarh'],
  ['Khariar Autonomous College', 'Khariar, Nuapada', D, 'khariar'],
  ['Government College, Phulbani', 'Phulbani', D, 'phulbani kandhamal'],
  ['Science College (Autonomous), Hinjilicut', 'Hinjilicut', D, 'science college hinjili'],
  ['Binayak Acharya College', 'Berhampur', D, 'binayak acharya'],
  ['S.B.R. Government Women\'s College', 'Berhampur', D, 'sbr women'],
  ['Aska Science College', 'Aska', D, 'aska'],
  ['S.K.C.G. Autonomous College', 'Paralakhemundi', D, 'skcg'],
  ['Rayagada Autonomous College', 'Rayagada', D, 'rayagada'],
  ['Nabarangpur College', 'Nabarangpur', D, 'nabarangapur'],

  // +2 colleges and schools with 11th and 12th
  ['BJB Higher Secondary School', 'Bhubaneswar', H, 'bjb plus two junior college chse'],
  ['Kendriya Vidyalaya No. 1, Bhubaneswar', 'Bhubaneswar', S, 'kv unit 9 cbse'],
  ['Kendriya Vidyalaya No. 2, Bhubaneswar', 'Bhubaneswar', S, 'kv cbse'],
  ['Kendriya Vidyalaya No. 3, Bhubaneswar', 'Bhubaneswar', S, 'kv cbse'],
  ['Kendriya Vidyalaya No. 4, Bhubaneswar', 'Bhubaneswar', S, 'kv cbse'],
  ['Kendriya Vidyalaya No. 5, Bhubaneswar', 'Bhubaneswar', S, 'kv cbse'],
  ['Kendriya Vidyalaya No. 6, Bhubaneswar', 'Bhubaneswar', S, 'kv cbse'],
  ['DAV Public School, Unit-8', 'Bhubaneswar', S, 'dav cbse'],
  ['DAV Public School, Chandrasekharpur', 'Bhubaneswar', S, 'dav csp cbse'],
  ['DAV Public School, Pokhariput', 'Bhubaneswar', S, 'dav cbse'],
  ['DAV Public School, CDA Sector-6', 'Cuttack', S, 'dav cbse'],
  ['DAV Public School, NALCO Nagar', 'Angul', S, 'dav nalco cbse'],
  ['Mother\'s Public School', 'Bhubaneswar', S, 'mps cbse'],
  ['SAI International School', 'Bhubaneswar', S, 'sai cbse'],
  ['ODM Public School', 'Bhubaneswar', S, 'odm cbse'],
  ['KiiT International School', 'Bhubaneswar', S, 'kiit kis cbse'],
  ['Demonstration Multipurpose School (RIE)', 'Bhubaneswar', S, 'dm school rie cbse'],
  ['Loyola School', 'Bhubaneswar', S, 'loyola icse isc'],
  ['Stewart School', 'Bhubaneswar', S, 'stewart icse isc'],
  ['Stewart School', 'Cuttack', S, 'stewart icse isc'],
  ['Delhi Public School Kalinga', 'Cuttack', S, 'dps cbse'],
  ['Delhi Public School', 'Rourkela', S, 'dps cbse'],
  ['Delhi Public School', 'Damanjodi', S, 'dps nalco cbse'],
  ['Vikash Residential School', 'Bargarh', S, 'vikash plus two cbse'],

  // Medical, dental, AYUSH
  ['SCB Medical College and Hospital', 'Cuttack', MED, 'scb mbbs'],
  ['S.C.B. Dental College and Hospital', 'Cuttack', MED, 'scb dental bds'],
  ['MKCG Medical College and Hospital', 'Berhampur', MED, 'mkcg mbbs'],
  ['Veer Surendra Sai Institute of Medical Sciences and Research (VIMSAR)', 'Burla', MED, 'vimsar mbbs'],
  ['Pandit Raghunath Murmu Medical College and Hospital', 'Baripada', MED, 'prm mbbs'],
  ['Saheed Laxman Nayak Medical College and Hospital', 'Koraput', MED, 'sln mbbs'],
  ['Fakir Mohan Medical College and Hospital', 'Balasore', MED, 'fm mbbs'],
  ['Bhima Bhoi Medical College and Hospital', 'Balangir', MED, 'bbmch mbbs'],
  ['Dharanidhar Medical College and Hospital', 'Keonjhar', MED, 'mbbs'],
  ['Government Medical College and Hospital, Sundargarh', 'Sundargarh', MED, 'mbbs'],
  ['Government Medical College and Hospital, Phulbani', 'Phulbani', MED, 'mbbs'],
  ['Maharaja Jajati Keshari Medical College and Hospital', 'Jajpur', MED, 'mjkmch mbbs'],
  ['Pabitra Mohan Pradhan Medical College and Hospital', 'Talcher', MED, 'mbbs'],
  ['Saheed Rendo Majhi Medical College and Hospital', 'Bhawanipatna', MED, 'mbbs'],
  ['Sri Jagannath Medical College and Hospital', 'Puri', MED, 'mbbs'],
  ['PGIMER and Capital Hospital', 'Bhubaneswar', MED, 'pgimer'],
  ['Acharya Harihar Post Graduate Institute of Cancer', 'Cuttack', MED, 'ahpgic'],
  ['Hi-Tech Medical College and Hospital', 'Bhubaneswar', MED, 'hitech mbbs'],
  ['Hi-Tech Medical College and Hospital', 'Rourkela', MED, 'hitech mbbs'],
  ['Hi-Tech Dental College and Hospital', 'Bhubaneswar', MED, 'hitech bds'],
  ['Institute of Medical Sciences and SUM Hospital (SOA)', 'Bhubaneswar', MED, 'ims sum soa mbbs'],
  ['Institute of Dental Sciences (SOA)', 'Bhubaneswar', MED, 'ids soa bds'],
  ['Kalinga Institute of Medical Sciences (KIMS)', 'Bhubaneswar', MED, 'kims kiit mbbs'],
  ['Kalinga Institute of Dental Sciences (KIDS)', 'Bhubaneswar', MED, 'kids kiit bds'],
  ['Ispat Post Graduate Institute and Super Specialty Hospital', 'Rourkela', MED, 'ispat'],
  ['Swami Vivekanand National Institute of Rehabilitation Training and Research', 'Olatpur, Cuttack', MED, 'svnirtar bpt bot'],
  ['Gopabandhu Ayurveda Mahavidyalaya', 'Puri', MED, 'bams ayurveda'],
  ['Government Ayurvedic College and Hospital', 'Balangir', MED, 'bams ayurveda'],
  ['Kaviraj Ananta Tripathy Sharma Ayurvedic College and Hospital', 'Berhampur', MED, 'bams ayurveda'],
  ['Indira Gandhi Memorial Ayurvedic College and Hospital', 'Bhubaneswar', MED, 'bams ayurveda'],
  ['Dr. Abhin Chandra Homoeopathic Medical College and Hospital', 'Bhubaneswar', MED, 'bhms homeopathy'],
  ['Odisha Medical College of Homoeopathy and Research', 'Sambalpur', MED, 'bhms homeopathy'],
  ['Biju Pattnaik Homoeopathic Medical College and Hospital', 'Berhampur', MED, 'bhms homeopathy'],
  ['Utkalmani Homoeopathic Medical College and Hospital', 'Rourkela', MED, 'bhms homeopathy'],

  // Pharmacy
  ['University Department of Pharmaceutical Sciences, Utkal University', 'Bhubaneswar', P, 'udps bpharm'],
  ['College of Pharmaceutical Sciences', 'Bhubaneswar', P, 'cps tamando bpharm'],
  ['College of Pharmaceutical Sciences', 'Puri', P, 'cps baliguali bpharm'],
  ['College of Pharmaceutical Sciences, Mohuda', 'Berhampur', P, 'cps bpharm'],
  ['Dadhichi College of Pharmacy', 'Cuttack', P, 'bpharm'],
  ['Gayatri College of Pharmacy', 'Sambalpur', P, 'bpharm'],
  ['Indira Gandhi Institute of Pharmaceutical Sciences', 'Bhubaneswar', P, 'igips bpharm'],
  ['Institute of Health Sciences', 'Bhubaneswar', P, 'ihs bpharm'],
  ['Institute of Pharmacy and Technology', 'Salipur', P, 'bpharm'],
  ['Jeypore College of Pharmacy', 'Jeypore', P, 'bpharm'],
  ['Kanak Manjari Institute of Pharmaceutical Sciences', 'Rourkela', P, 'kmips bpharm'],
  ['Roland Institute of Pharmaceutical Sciences', 'Berhampur', P, 'rips bpharm'],
  ['Sri Jayadev College of Pharmaceutical Sciences', 'Bhubaneswar', P, 'bpharm'],

  // Law
  ['University Law College, Utkal University', 'Bhubaneswar', L, 'vani vihar llb'],
  ['KIIT School of Law', 'Bhubaneswar', L, 'ksol kiit llb'],
  ['Xavier Law School', 'Bhubaneswar', L, 'xls llb'],
  ['Capital Law College', 'Bhubaneswar', L, 'llb'],
  ['Lingaraj Law College', 'Berhampur', L, 'llb'],
  ['Ganjam Law College', 'Berhampur', L, 'llb'],
  ['Lajpat Rai Law College', 'Sambalpur', L, 'llb'],
  ['Balasore Law College', 'Balasore', L, 'llb'],
  ['Bhadrak Law College', 'Bhadrak', L, 'llb'],
  ['Dhenkanal Law College', 'Dhenkanal', L, 'llb'],
  ['Gangadhar Mohapatra Law College', 'Puri', L, 'llb'],
  ['Mayurbhanj Law College', 'Baripada', L, 'llb'],
  ['Pravash Manjari Law College', 'Keonjhar', L, 'llb'],
  ['Rourkela Law College', 'Rourkela', L, 'llb'],
];

/** Groups with many branches: picking one fills "Name, " so the student adds the branch. */
const BRANCH_ROWS: Row[] = [
  ['Kendriya Vidyalaya', '', S, 'kv cbse central school'],
  ['Jawahar Navodaya Vidyalaya', '', S, 'jnv navodaya cbse'],
  ['Odisha Adarsha Vidyalaya', '', S, 'oav adarsha cbse'],
  ['DAV Public School', '', S, 'dav cbse'],
  ['Delhi Public School', '', S, 'dps cbse'],
  ['Saraswati Sishu Vidya Mandir', '', S, 'ssvm sishu mandir'],
  ['Government Higher Secondary School', '', H, 'ghss plus two junior college chse'],
  ['Government Junior College', '', H, 'plus two chse'],
  ['Government Degree College', '', D, 'plus three'],
  ['Government Women\'s College', '', D, 'women'],
];

const LEVEL_WORDS: Record<CollegeCategory, string> = {
  University: 'university graduation ug pg imba integrated',
  Engineering: 'engineering btech b.tech technology diploma',
  'Management (MBA/MCA)': 'management mba mca bba bca imba integrated pgdm',
  'Degree College': 'degree graduation plus three +3 ba bsc bcom ug arts science commerce bba bca',
  '+2 Higher Secondary': 'plus two +2 higher secondary 11th 12th junior college chse arts science commerce',
  'School (+2)': 'school plus two +2 11th 12th',
  'Medical & Health': 'medical mbbs health nursing',
  Pharmacy: 'pharmacy bpharm',
  Law: 'law llb',
  Other: '',
};

export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim();
}

function toOption([name, city, category, aliases = '']: Row, needsBranch: boolean): CollegeOption {
  const includesCity = !city || normalizeForSearch(name).includes(normalizeForSearch(city.split(',')[0]));
  const value = needsBranch ? `${name}, ` : includesCity ? name : `${name}, ${city}`;
  return {
    value,
    name,
    city,
    category,
    needsBranch,
    haystack: normalizeForSearch(`${name} ${city} ${aliases} ${LEVEL_WORDS[category]}`),
    nameKey: normalizeForSearch(name),
    aliasKey: ` ${normalizeForSearch(aliases)} `,
  };
}

/** Hand-checked list, always available. */
export const ODISHA_COLLEGES: CollegeOption[] = [
  ...ROWS.map((row) => toOption(row, false)),
  ...BRANCH_ROWS.map((row) => toOption(row, true)),
];

const EXTRA_CATEGORY: Record<ExtraCategoryCode, CollegeCategory> = { H, D, E, M, MED, L };

/** Same institution even when written slightly differently ("B J B (Autonomous) College"). */
function duplicateKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '') // short forms such as "(OEC)"
    .replace(/&/g, 'and')
    .replace(/autonomous|[^a-z0-9]/g, '');
}

/** Hand-checked list first, then the large generated list without duplicates. */
export function mergeColleges(extraRows: [string, string, ExtraCategoryCode][]): CollegeOption[] {
  const known = new Map<string, string[]>();
  for (const option of ODISHA_COLLEGES) {
    const key = duplicateKey(option.name);
    known.set(key, [...(known.get(key) ?? []), option.city.toLowerCase()]);
  }
  const extras: CollegeOption[] = [];
  for (const [name, city, code] of extraRows) {
    const cities = known.get(duplicateKey(name));
    if (cities && (!city || cities.some((c) => !c || c === city.toLowerCase() || name.toLowerCase().includes(c)))) continue;
    extras.push(toOption([name, city, EXTRA_CATEGORY[code]], false));
  }
  return [...ODISHA_COLLEGES, ...extras];
}

let allColleges: Promise<CollegeOption[]> | null = null;

/** Loads the full list (about 2,000 institutions) on first use and keeps it. */
export function loadAllColleges(): Promise<CollegeOption[]> {
  allColleges ??= import('./odishaCollegesExtra')
    .then((module) => mergeColleges(module.EXTRA_COLLEGE_ROWS))
    .catch(() => {
      allColleges = null;
      return ODISHA_COLLEGES;
    });
  return allColleges;
}

/**
 * Every word typed must appear somewhere in the option. Matches at the start of the name
 * come first, then matches at a word start in the name, then everything else.
 */
export function searchColleges(query: string, limit = 40, options = ODISHA_COLLEGES): CollegeOption[] {
  const q = normalizeForSearch(query);
  if (!q) return options.slice(0, limit);
  const words = q.split(' ');
  const scored: { option: CollegeOption; score: number; index: number }[] = [];
  options.forEach((option, index) => {
    if (!words.every((word) => option.haystack.includes(word))) return;
    const name = option.nameKey;
    let score = 5;
    if (name.startsWith(q)) score = 0;
    else if (` ${name} `.includes(` ${q} `)) score = 1; // whole word in the name, e.g. "(ITER)"
    else if (option.aliasKey.includes(` ${q} `)) score = 2; // known short form, e.g. "cet"
    else if (` ${name}`.includes(` ${q}`)) score = 3;
    else if (words.every((word) => ` ${name}`.includes(` ${word}`) || option.aliasKey.includes(` ${word}`))) score = 4;
    scored.push({ option, score, index });
  });
  scored.sort((a, b) => a.score - b.score || a.index - b.index);
  return scored.slice(0, limit).map((entry) => entry.option);
}
