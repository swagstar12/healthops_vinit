import React, { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [contactForm, setContactForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    department: "",
    message: ""
  });
  
  const { login } = useAuth();
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    if (!email || !password) {
      setErr("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.post("/auth/login", { email, password });
      login({ fullName: data.fullName, role: data.role, token: data.token });
      nav("/");
    } catch (e: any) {
      if (e.response?.status === 401) {
        setErr("Invalid email or password");
      } else {
        setErr("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Add your contact form submission logic here
    alert('Message sent successfully! We will get back to you soon.');
    setContactForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      department: "",
      message: ""
    });
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen w-full">
      {/* Top Navbar */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-center px-10 py-6 z-20 bg-white/90 backdrop-blur-sm">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          Meera Multispecialty Hospital
        </h1>
        <nav className="space-x-6 text-gray-700 font-medium hidden md:flex">
          <button 
            onClick={() => scrollToSection('about')}
            className="hover:text-blue-600 transition cursor-pointer"
          >
            About Us
          </button>
          <button 
            onClick={() => scrollToSection('services')}
            className="hover:text-blue-600 transition cursor-pointer"
          >
            Services
          </button>
          <button 
            onClick={() => scrollToSection('contact')}
            className="hover:text-blue-600 transition cursor-pointer"
          >
            Contact Us
          </button>
        </nav>
      </header>

      {/* Hero Section with Login */}
      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* Left Side - Hospital Background */}
        <div
          className="relative lg:w-1/2 bg-cover bg-center min-h-[400px] lg:min-h-screen"
          style={{
            backgroundImage:
              "url('https://www.lakeshoresurgerycenter.com/wp-content/uploads/PAS_7350-1-1200x801.jpg')",
          }}
        >
          <div className="absolute inset-0 bg-blue-900 bg-opacity-70 flex flex-col justify-center items-center text-center p-8">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">
              Caring for Life
            </h2>
            <p className="text-blue-100 text-xl max-w-lg leading-relaxed">
              Excellence in healthcare, compassion in service. Your health is our priority.
            </p>
          </div>
        </div>

        {/* Right Side - Login Section */}
        <div className="flex w-full lg:w-1/2 items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="card w-full max-w-lg">
            <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">
              Doctors & Staff Login
            </h2>
            <form className="space-y-6" onSubmit={submit}>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e: { target: { value: any; }; }) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e: { target: { value: any; }; }) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={rememberMe}
                    onChange={(e: { target: { checked: any; }; }) => setRememberMe(e.target.checked)}
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 block text-gray-600 cursor-pointer"
                  >
                    Remember me
                  </label>
                </div>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Forgot password?
                </button>
              </div>

              {/* Error Message */}
              {err && (
                <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded-lg text-sm">
                  {err}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="btn w-full flex justify-center items-center"
              >
                {loading ? (
                  <>
                    <span className="spinner mr-2"></span> Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              Need help? Contact IT Support: <br />
              <span className="font-semibold text-blue-600">support@meerahospital.com</span>
            </div>
          </div>
        </div>
      </div>

      {/* About Us Section */}
      <section id="about" className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-gray-800 mb-6 text-center">
            About Meera Multispecialty Hospital
          </h2>
          <p className="text-lg text-gray-600 text-center mb-12 max-w-3xl mx-auto">
            Established with a vision to provide comprehensive healthcare services, we are committed to delivering world-class medical care with compassion and excellence.
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-xl mb-4 mx-auto">
                🏥
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">2+ Years of Excellence</h3>
              <p className="text-gray-600">Serving the community with dedication and advanced medical care since 2023.</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-xl mb-4 mx-auto">
                👨‍⚕️
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Expert Medical Team</h3>
              <p className="text-gray-600">Board-certified specialists and experienced healthcare professionals.</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-xl mb-4 mx-auto">
                ⚡
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">24/7 Emergency Care</h3>
              <p className="text-gray-600">Round-the-clock emergency services with state-of-the-art equipment.</p>
            </div>
          </div>

          <div className="mt-16 bg-gray-50 rounded-2xl p-8">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-3xl font-bold text-gray-800 mb-6">Our Mission</h3>
                <p className="text-gray-600 text-lg leading-relaxed mb-6">
                  To provide exceptional healthcare services that combine advanced medical technology with personalized, compassionate care. We strive to improve the health and well-being of our community through innovative treatments and preventive care.
                </p>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-white p-4 rounded-lg shadow">
                    <div className="text-2xl font-bold text-blue-600">50+</div>
                    <div className="text-gray-600">Beds</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <div className="text-2xl font-bold text-blue-600">10+</div>
                    <div className="text-gray-600">Specialists</div>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-8 text-white">
                <h4 className="text-2xl font-bold mb-4">Our Values</h4>
                <ul className="space-y-3">
                  <li className="flex items-center"><span className="mr-3">✓</span>Compassionate Care</li>
                  <li className="flex items-center"><span className="mr-3">✓</span>Clinical Excellence</li>
                  <li className="flex items-center"><span className="mr-3">✓</span>Patient Safety</li>
                  <li className="flex items-center"><span className="mr-3">✓</span>24/7 Availability</li>
                  <li className="flex items-center"><span className="mr-3">✓</span>Community Service</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-gray-800 mb-6 text-center">Our Medical Services</h2>
          <p className="text-lg text-gray-600 text-center mb-12 max-w-3xl mx-auto">
            Comprehensive healthcare services across multiple specialties, delivered by our expert medical team using advanced technology and evidence-based practices.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: "❤️",
                title: "Cardiology",
                description: "Advanced cardiac care including interventional cardiology, cardiac surgery, and preventive heart health programs.",
                services: ["Cardiac Catheterization", "Angioplasty & Stenting", "Heart Surgery", "ECG & Echo Services"]
              },
              {
                icon: "🧠",
                title: "Neurology",
                description: "Comprehensive neurological care for brain, spine, and nervous system disorders.",
                services: ["Brain & Spine Surgery", "Stroke Treatment", "Epilepsy Management", "Neurological Rehabilitation"]
              },
              {
                icon: "🦴",
                title: "Orthopedics",
                description: "Expert treatment for bone, joint, and musculoskeletal conditions with minimally invasive techniques.",
                services: ["Joint Replacement", "Arthroscopic Surgery", "Trauma Care", "Sports Medicine"]
              },
              {
                icon: "👶",
                title: "Pediatrics",
                description: "Specialized healthcare for infants, children, and adolescents with child-friendly environment.",
                services: ["Newborn Care", "Pediatric Surgery", "Vaccination Programs", "Child Development"]
              },
              {
                icon: "👩‍⚕️",
                title: "Gynecology",
                description: "Complete women's healthcare including maternity, fertility treatments, and gynecological surgeries.",
                services: ["Maternity Care", "Fertility Treatment", "Minimally Invasive Surgery", "Women's Health Screenings"]
              },
              {
                icon: "🔬",
                title: "Diagnostics",
                description: "State-of-the-art diagnostic services with accurate and timely results for better treatment planning.",
                services: ["MRI & CT Scans", "Laboratory Services", "Digital X-Ray", "Pathology Services"]
              }
            ].map((service, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-xl mb-4">
                  {service.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">{service.title}</h3>
                <p className="text-gray-600 mb-4">{service.description}</p>
                <ul className="text-sm text-gray-500 space-y-1">
                  {service.services.map((item, idx) => (
                    <li key={idx}>• {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <div className="bg-white rounded-2xl p-8 shadow-lg inline-block">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Emergency Services</h3>
              <p className="text-gray-600 mb-6">24/7 emergency care with trauma center and critical care units</p>
              <div className="flex justify-center items-center space-x-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">24/7</div>
                  <div className="text-gray-600">Emergency</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">108</div>
                  <div className="text-gray-600">Ambulance</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">ICU</div>
                  <div className="text-gray-600">Critical Care</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section id="contact" className="py-20 bg-gray-800 text-white">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-white mb-6 text-center">Contact Us</h2>
          <p className="text-lg text-gray-300 text-center mb-12 max-w-3xl mx-auto">
            Get in touch with us for appointments, inquiries, or emergency services. We're here to help you 24/7.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            <div className="bg-gray-700 p-8 rounded-xl">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xl mb-4">
                📍
              </div>
              <h3 className="text-xl font-bold mb-3">Hospital Address</h3>
              <p className="text-gray-300">
                123 Medical Center Drive<br />
                Healthcare District<br />
                Pune, Maharashtra 411001<br />
                India
              </p>
            </div>

            <div className="bg-gray-700 p-8 rounded-xl">
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center text-white text-xl mb-4">
                📞
              </div>
              <h3 className="text-xl font-bold mb-3">Phone Numbers</h3>
              <p className="text-gray-300">
                <strong>Main:</strong> +91-20-2567-8900<br />
                <strong>Emergency:</strong> +91-20-2567-8911<br />
                <strong>Appointments:</strong> +91-20-2567-8922<br />
                <strong>Toll Free:</strong> 1800-123-4567
              </p>
            </div>

            <div className="bg-gray-700 p-8 rounded-xl">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center text-white text-xl mb-4">
                📧
              </div>
              <h3 className="text-xl font-bold mb-3">Email & Web</h3>
              <p className="text-gray-300">
                <strong>General:</strong> info@meerahospital.com<br />
                <strong>Appointments:</strong> appointments@meerahospital.com<br />
                <strong>Emergency:</strong> emergency@meerahospital.com<br />
                <strong>Website:</strong> www.meerahospital.com
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div className="bg-gray-700 p-8 rounded-xl">
              <h3 className="text-2xl font-bold mb-6">Send us a Message</h3>
              <form className="space-y-4" onSubmit={handleContactSubmit}>
                <div className="grid md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="First Name"
                    className="w-full px-4 py-3 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-600 text-white placeholder-gray-400"
                    value={contactForm.firstName}
                    onChange={(e: { target: { value: any; }; }) => setContactForm({...contactForm, firstName: e.target.value})}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    className="w-full px-4 py-3 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-600 text-white placeholder-gray-400"
                    value={contactForm.lastName}
                    onChange={(e: { target: { value: any; }; }) => setContactForm({...contactForm, lastName: e.target.value})}
                    required
                  />
                </div>
                <input
                  type="email"
                  placeholder="Email Address"
                  className="w-full px-4 py-3 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-600 text-white placeholder-gray-400"
                  value={contactForm.email}
                  onChange={(e: { target: { value: any; }; }) => setContactForm({...contactForm, email: e.target.value})}
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  className="w-full px-4 py-3 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-600 text-white placeholder-gray-400"
                  value={contactForm.phone}
                  onChange={(e: { target: { value: any; }; }) => setContactForm({...contactForm, phone: e.target.value})}
                />
                <select
                  className="w-full px-4 py-3 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-600 text-white"
                  value={contactForm.department}
                  onChange={(e: { target: { value: any; }; }) => setContactForm({...contactForm, department: e.target.value})}
                  required
                >
                  <option value="">Select Department</option>
                  <option value="general">General Inquiry</option>
                  <option value="appointment">Appointment Request</option>
                  <option value="emergency">Emergency</option>
                  <option value="billing">Billing</option>
                  <option value="feedback">Feedback</option>
                </select>
                <textarea
                  placeholder="Your Message"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-600 text-white placeholder-gray-400"
                  value={contactForm.message}
                  onChange={(e: { target: { value: any; }; }) => setContactForm({...contactForm, message: e.target.value})}
                  required
                />
                <button type="submit" className="btn w-full">
                  Send Message
                </button>
              </form>
            </div>

            {/* Hospital Information */}
            <div className="space-y-8">
              <div className="bg-gray-700 p-8 rounded-xl">
                <h3 className="text-2xl font-bold mb-6">Hospital Hours</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Emergency Services:</span>
                    <span className="text-green-400 font-semibold">24/7</span>
                  </div>
                  <div className="flex justify-between">
                    <span>OPD Timings:</span>
                    <span>8:00 AM - 8:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pharmacy:</span>
                    <span>24 Hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Laboratory:</span>
                    <span>6:00 AM - 10:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Radiology:</span>
                    <span>24 Hours</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700 p-8 rounded-xl">
                <h3 className="text-2xl font-bold mb-6">Quick Links</h3>
                <div className="grid grid-cols-2 gap-3">
                  <a href="#" className="text-blue-400 hover:text-blue-300 transition">Patient Portal</a>
                  <a href="#" className="text-blue-400 hover:text-blue-300 transition">Find a Doctor</a>
                  <a href="#" className="text-blue-400 hover:text-blue-300 transition">Health Packages</a>
                  <a href="#" className="text-blue-400 hover:text-blue-300 transition">Insurance</a>
                  <a href="#" className="text-blue-400 hover:text-blue-300 transition">Medical Records</a>
                  <a href="#" className="text-blue-400 hover:text-blue-300 transition">Careers</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h4 className="text-white font-bold text-lg mb-4">Meera Multispecialty Hospital</h4>
              <p className="text-sm">Your trusted healthcare partner providing comprehensive medical services with compassion and excellence.</p>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Quick Links</h5>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => scrollToSection('about')} className="hover:text-white transition">About Us</button></li>
                <li><button onClick={() => scrollToSection('services')} className="hover:text-white transition">Services</button></li>
                <li><button onClick={() => scrollToSection('contact')} className="hover:text-white transition">Contact</button></li>
                <li><a href="#" className="hover:text-white transition">Careers</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Patient Services</h5>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Book Appointment</a></li>
                <li><a href="#" className="hover:text-white transition">Patient Portal</a></li>
                <li><a href="#" className="hover:text-white transition">Health Packages</a></li>
                <li><a href="#" className="hover:text-white transition">Insurance</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Emergency</h5>
              <p className="text-sm mb-2">24/7 Emergency Services</p>
              <p className="text-lg font-bold text-red-400">+91-20-2567-8911</p>
              <p className="text-sm mt-2">Ambulance: 108</p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; 2025 Meera Multispecialty Hospital. All rights reserved. | <a href="#" className="hover:text-white">Privacy Policy</a> | <a href="#" className="hover:text-white">Terms of Service</a></p>
          </div>
        </div>
      </footer>
    </div>
  );
}