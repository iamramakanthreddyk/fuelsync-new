
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from 'react-router-dom';
import { CheckCircle, BarChart3, Upload, Shield, Users, Fuel } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Upload className="h-8 w-8 text-white" />,
      title: "Smart OCR Processing",
      description: "Upload fuel receipts and let AI extract data automatically"
    },
    {
      icon: <BarChart3 className="h-8 w-8 text-white" />,
      title: "Real-time Analytics",
      description: "Track sales, monitor performance, and make data-driven decisions"
    },
    {
      icon: <Users className="h-8 w-8 text-white" />,
      title: "Team Management",
      description: "Manage employees with role-based access and permissions"
    },
    {
      icon: <Shield className="h-8 w-8 text-white" />,
      title: "Secure Cloud Storage",
      description: "Your data is safe with enterprise-grade security"
    }
  ];

  const plans = [
    {
      name: "Basic",
      price: "₹999",
      period: "/month",
      trial: "3-month free trial",
      features: [
        "Up to 2 employees",
        "3 pumps maximum",
        "5 OCR uploads per day",
        "Basic analytics",
        "Email support"
      ],
      popular: false
    },
    {
      name: "Premium",
      price: "₹2,499",
      period: "/month",
      trial: "14-day free trial",
      features: [
        "Up to 5 employees",
        "5 pumps maximum", 
        "10 OCR uploads per day",
        "Advanced analytics",
        "Priority support",
        "Export reports"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "pricing",
      trial: "Contact us",
      features: [
        "Unlimited employees",
        "Unlimited pumps",
        "Unlimited uploads",
        "Multi-station support",
        "Dedicated support",
        "Custom integrations"
      ],
      popular: false
    }
  ];

  const handleWhatsAppContact = () => {
    window.open('https://wa.me/918121937837?text=Hi, I am interested in FuelSync for my fuel station. Please provide more details.', '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <Fuel className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">FuelSync</span>
          </div>
          <div className="space-x-4">
            <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => navigate('/login')}>
              Login
            </Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => navigate('/login')}>
              Get Started
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Monitor.<br />
            Optimize.<br />
            <span className="text-orange-400">Grow.</span>
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            FuelSync: Your fuel station, smarter than ever. Manage pumps, track sales, and grow your business with intelligent automation.
          </p>
          <Button 
            size="lg" 
            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 text-lg rounded-full mr-4"
            onClick={handleWhatsAppContact}
          >
            Contact on WhatsApp
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 px-8 py-4 text-lg rounded-full"
            onClick={() => navigate('/login')}
          >
            Try Demo
          </Button>
          <p className="text-blue-200 mt-4">WhatsApp: +91 81219 37837 • Free consultation</p>
        </div>

        {/* Hero Visual */}
        <div className="mt-16 relative">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8 max-w-2xl mx-auto">
            <div className="flex items-center justify-center space-x-4 mb-6">
              <div className="w-16 h-16 bg-orange-500 rounded-xl flex items-center justify-center">
                <Fuel className="h-8 w-8 text-white" />
              </div>
              <div className="text-white/60 text-4xl">→</div>
              <div className="w-16 h-16 bg-blue-500 rounded-xl flex items-center justify-center">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
            </div>
            <p className="text-white/80 text-lg">Transform manual operations into intelligent insights</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Choose FuelSync?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to manage your fuel station efficiently in one powerful platform
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Additional Features */}
          <div className="mt-16 text-center">
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                <span className="text-lg text-gray-700">Fast reporting</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                <span className="text-lg text-gray-700">Data-driven analytics</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                <span className="text-lg text-gray-700">Secure cloud storage</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="bg-gray-50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Plan</h2>
            <p className="text-xl text-gray-600">Scale with plans that grow with your business</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <Card key={index} className={`relative ${plan.popular ? 'border-2 border-orange-500 shadow-xl' : 'border shadow-lg'}`}>
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white px-4 py-1">
                    Most Popular
                  </Badge>
                )}
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    <div className="mb-2">
                      <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                      <span className="text-gray-600">{plan.period}</span>
                    </div>
                    <p className="text-sm text-orange-600 font-medium">{plan.trial}</p>
                  </div>
                  
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center space-x-3">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className={`w-full ${plan.popular ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                    onClick={plan.name === 'Enterprise' ? handleWhatsAppContact : () => navigate('/login')}
                  >
                    {plan.name === 'Enterprise' ? 'Contact on WhatsApp' : 'Start Free Trial'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to Transform Your Fuel Station?</h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join hundreds of fuel station owners who have streamlined their operations with FuelSync
          </p>
          <Button 
            size="lg" 
            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 text-lg rounded-full"
            onClick={handleWhatsAppContact}
          >
            Contact Us on WhatsApp
          </Button>
          <p className="text-blue-200 mt-4">WhatsApp: +91 81219 37837</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-blue-900 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <Fuel className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">FuelSync</span>
              </div>
              <p className="text-blue-200">Smart fuel station management for the modern world.</p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-blue-200">
                <li>Features</li>
                <li>Pricing</li>
                <li>Enterprise</li>
                <li>Security</li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-blue-200">
                <li>Help Center</li>
                <li>Contact Us</li>
                <li>System Status</li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-blue-200">
                <li>About Us</li>
                <li>Careers</li>
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-blue-800 mt-8 pt-8 text-center text-blue-200">
            <p>&copy; 2024 FuelSync. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
