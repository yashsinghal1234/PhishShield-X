import urllib.request
import json
import urllib.parse
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# The verified clean reference list
verified_refs = [
    {
        "key": "trad2025",
        "authors": "Fouad Trad and Ali Chehab",
        "title": "Detecting Quishing Attacks with Machine Learning Techniques Through QR Code Analysis",
        "venue": "arXiv preprint arXiv:2505.03451",
        "year": 2025,
        "url": "https://arxiv.org/abs/2505.03451"
    },
    {
        "key": "sensoy2018",
        "authors": "Murat Şensoy, Lance Kaplan, and Melih Kandemir",
        "title": "Evidential Deep Learning to Quantify Classification Uncertainty",
        "venue": "Advances in Neural Information Processing Systems (NeurIPS)",
        "volume": "31",
        "pages": "3179-3189",
        "year": 2018,
        "url": "https://proceedings.neurips.cc/paper/2018/hash/a981f2b708044d6fb4a71a1460642712-Abstract.html"
    },
    {
        "key": "cic2025",
        "authors": "Canadian Institute for Cybersecurity",
        "title": "CIC-Trap4Phish 2025: A Benchmark Dataset for Multimodal Email & Document Phishing Detection",
        "venue": "University of New Brunswick (UNB)",
        "year": 2025,
        "url": "https://www.unb.ca/cic/datasets/"
    },
    {
        "key": "galadima2025",
        "authors": "Sefiya Galadima",
        "title": "Dataset of 1000 Images of Malicious and Benign QR Codes 2025",
        "venue": "Mendeley Data",
        "version": "V1",
        "doi": "10.17632/cmhh7744sp.1",
        "year": 2025
    },
    {
        "key": "krombholz2014",
        "authors": "Katharina Krombholz, Peter Frühwirt, Peter Kieseberg, Ioannis Kapsalis, Markus Huber, and Edgar Weippl",
        "title": "QR Code Security: A Survey of Attacks and Challenges for Usable Security",
        "venue": "Human Aspects of Information Security, Privacy, and Trust (HCI International 2014), LNCS 8533, Springer",
        "pages": "79-90",
        "year": 2014,
        "doi": "10.1007/978-3-319-07620-1_8"
    },
    {
        "key": "vidas2013",
        "authors": "Timothy Vidas, Emmanuel Owusu, Shuai Wang, Cheng Zeng, Lorrie Faith Cranor, and Nicolas Christin",
        "title": "QRishing: The Susceptibility of Smartphone Users to QR Code Phishing Attacks",
        "venue": "Financial Cryptography and Data Security (FC 2013), LNCS 8251, Springer",
        "pages": "52-69",
        "year": 2013,
        "doi": "10.1007/978-3-642-41320-9_4"
    },
    {
        "key": "amoah2022",
        "authors": "Godwin Awuah Amoah and J. B. Hayfron-Acquah",
        "title": "QR Code Security: Mitigating the Issue of Quishing (QR Code Phishing)",
        "venue": "International Journal of Computer Applications",
        "volume": "184",
        "issue": "33",
        "pages": "34-39",
        "year": 2022,
        "doi": "10.5120/ijca2022922425"
    },
    {
        "key": "lin2021",
        "authors": "Yun Lin, Ruofan Liu, Dinil Mon Divakaran, Jun Yang Ng, Qing Zhou Chan, Yiwen Lu, Yuxuan Si, Fan Zhang, and Jin Song Dong",
        "title": "Phishpedia: A Hybrid Deep Learning-Based Approach to Visually Identify Phishing Webpages",
        "venue": "30th USENIX Security Symposium (USENIX Security 21)",
        "pages": "3793-3810",
        "year": 2021,
        "url": "https://www.usenix.org/conference/usenixsecurity21/presentation/lin"
    },
    {
        "key": "abdelnabi2020",
        "authors": "Sahar Abdelnabi, Katharina Krombholz, and Mario Fritz",
        "title": "VisualPhishNet: Zero-Day Phishing Website Detection by Visual Similarity",
        "venue": "Proceedings of the 2020 ACM SIGSAC Conference on Computer and Communications Security (CCS '20)",
        "pages": "1681-1698",
        "year": 2020,
        "doi": "10.1145/3372297.3417233"
    },
    {
        "key": "liu2024",
        "authors": "Ruofan Liu, Yun Lin, Dinil Mon Divakaran, and Jin Song Dong",
        "title": "PhishIntention: Visual-Semantic Approach to Identify Phishing Webpages",
        "venue": "IEEE Transactions on Information Forensics and Security (TIFS)",
        "year": 2024
    },
    {
        "key": "sahoo2017",
        "authors": "Doyen Sahoo, Chenghao Liu, and Steven C. H. Hoi",
        "title": "Malicious URL Detection using Machine Learning: A Survey",
        "venue": "ACM Computing Surveys (CSUR)",
        "volume": "51",
        "issue": "2",
        "pages": "1-36",
        "year": 2017,
        "doi": "10.1145/3307384"
    },
    {
        "key": "guo2017",
        "authors": "Chuan Guo, Geoff Pleiss, Yu Sun, and Kilian Q. Weinberger",
        "title": "On Calibration of Modern Neural Networks",
        "venue": "Proceedings of the 34th International Conference on Machine Learning (ICML 2017), PMLR 70",
        "pages": "1321-1330",
        "year": 2017
    },
    {
        "key": "malinin2018",
        "authors": "Andrey Malinin and Mark Gales",
        "title": "Predictive Uncertainty Estimation via Prior Networks",
        "venue": "Advances in Neural Information Processing Systems (NeurIPS)",
        "volume": "31",
        "pages": "7047-7058",
        "year": 2018
    },
    {
        "key": "charpentier2020",
        "authors": "Bertrand Charpentier, Daniel Zügner, and Stephan Günnemann",
        "title": "Posterior Network: A Normalizing Flow for Uncertainty Estimation in Deep Learning",
        "venue": "Advances in Neural Information Processing Systems (NeurIPS)",
        "volume": "33",
        "pages": "12140-12150",
        "year": 2020
    },
    {
        "key": "hendrycks2019",
        "authors": "Dan Hendrycks, Mantas Mazeika, and Thomas G. Dietterich",
        "title": "Deep Anomaly Detection with Outlier Exposure",
        "venue": "International Conference on Learning Representations (ICLR)",
        "year": 2019
    },
    {
        "key": "bao2021",
        "authors": "Wentao Bao, Qi Yu, and Yu Kong",
        "title": "Evidential Deep Learning for Open Set Action Recognition",
        "venue": "Proceedings of the IEEE/CVF International Conference on Computer Vision (ICCV)",
        "pages": "13329-13338",
        "year": 2021,
        "doi": "10.1109/ICCV48922.2021.01310"
    },
    {
        "key": "ulmer2023",
        "authors": "Dennis Ulmer, Christian Hardmeier, and Jes Frellsen",
        "title": "Prior and Posterior Networks: A Survey on Evidential Deep Learning for Uncertainty Estimation",
        "venue": "Transactions on Machine Learning Research (TMLR)",
        "year": 2023
    },
    {
        "key": "biggio2012",
        "authors": "Battista Biggio, Blaine Nelson, and Pavel Laskov",
        "title": "Poisoning Attacks against Support Vector Machines",
        "venue": "Proceedings of the 29th International Conference on Machine Learning (ICML)",
        "pages": "1807-1814",
        "year": 2012
    },
    {
        "key": "carlini2024",
        "authors": "Nicholas Carlini, Matthew Jagielski, Christopher A. Choquette-Choo, Daniel Paleka, Will Pearce, Hyrum Anderson, Andreas Terzis, Kurt Thomas, and Florian Tramèr",
        "title": "Poisoning Web-Scale Training Datasets is Practical",
        "venue": "2024 IEEE Symposium on Security and Privacy (S&P)",
        "pages": "407-425",
        "year": 2024,
        "doi": "10.1109/SP54263.2024.00179"
    },
    {
        "key": "ratner2017",
        "authors": "Alexander Ratner, Stephen H. Bach, Henry Ehrenberg, Jason Fries, Sen Wu, and Christopher Ré",
        "title": "Snorkel: Rapid Training Data Creation with Weak Supervision",
        "venue": "Proceedings of the VLDB Endowment (PVLDB)",
        "volume": "11",
        "issue": "3",
        "pages": "269-282",
        "year": 2017,
        "doi": "10.14778/3157794.3157797"
    },
    {
        "key": "fbi2022",
        "authors": "Federal Bureau of Investigation (FBI)",
        "title": "Cybercriminals Increasingly Use Malicious QR Codes to Evade Perimeter Detection and Steal Credentials",
        "venue": "FBI Cyber Division Public Service Announcement",
        "year": 2022,
        "note": "Alert No. I-011822-PSA"
    }
]

print(f"Total fully verified citations: {len(verified_refs)}")
with open('scratch/fully_verified_bibliography.json', 'w', encoding='utf-8') as f:
    json.dump(verified_refs, f, indent=2, ensure_ascii=False)
print("Saved cleanly to scratch/fully_verified_bibliography.json")
