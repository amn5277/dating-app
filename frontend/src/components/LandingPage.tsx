import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HeartIcon, VideoCameraIcon, UserGroupIcon, SparklesIcon } from '@heroicons/react/24/outline';

const LandingPage: React.FC = () => {
  const features = [
    {
      icon: <HeartIcon className="h-8 w-8" />,
      title: "Personality-Based Matching",
      description: "Find compatible partners through detailed personality traits and interests, not just photos."
    },
    {
      icon: <VideoCameraIcon className="h-8 w-8" />,
      title: "1-Minute Video Dates",
      description: "Connect instantly with potential matches through quick video calls - authentic conversations first."
    },
    {
      icon: <UserGroupIcon className="h-8 w-8" />,
      title: "Smart Compatibility",
      description: "Our algorithm matches you based on shared interests, values, and relationship goals."
    },
    {
      icon: <SparklesIcon className="h-8 w-8" />,
      title: "Genuine Connections",
      description: "Skip the endless swiping and connect with people who truly match your personality."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 via-purple-600 to-secondary-600">
      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="mb-8"
            >
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white mb-6">
                Find Your Perfect
                <span className="block bg-gradient-to-r from-yellow-400 to-pink-400 bg-clip-text text-transparent">
                  Video Date
                </span>
              </h1>
              <p className="text-xl sm:text-2xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed">
                Connect through personality, not just photos. Experience authentic 1-minute video dates 
                with compatible matches based on your interests and traits.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link to="/register" className="btn-primary text-lg px-8 py-4 inline-block">
                Start Dating Now
              </Link>
              <Link to="/login" className="btn-secondary text-lg px-8 py-4 inline-block">
                Sign In
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Floating elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-4 h-4 bg-yellow-400 rounded-full opacity-70 animate-pulse"></div>
          <div className="absolute top-3/4 right-1/4 w-6 h-6 bg-pink-400 rounded-full opacity-60 animate-bounce"></div>
          <div className="absolute bottom-1/4 left-1/3 w-3 h-3 bg-white rounded-full opacity-50 animate-pulse"></div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Why Choose VideoDate?
            </h2>
            <p className="text-xl text-white/80 max-w-3xl mx-auto">
              Revolutionary dating experience that prioritizes authentic connections 
              over superficial swiping.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="glass-morphism p-6 rounded-2xl text-center hover:transform hover:scale-105 transition-all duration-300"
              >
                <div className="text-primary-600 mb-4 flex justify-center">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* How it Works Section */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 bg-black/10">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              How It Works
            </h2>
            <p className="text-xl text-white/80 max-w-3xl mx-auto">
              Simple, authentic, and effective - find meaningful connections in three easy steps.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="glass-morphism w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary-600">1</span>
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">Create Your Profile</h3>
              <p className="text-white/80">
                Share your personality traits, interests, and what you're looking for in a meaningful connection.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="glass-morphism w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary-600">2</span>
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">Get Matched</h3>
              <p className="text-white/80">
                Our smart algorithm finds compatible people based on personality and interests, then starts a video call.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="glass-morphism w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary-600">3</span>
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">Connect & Decide</h3>
              <p className="text-white/80">
                Have a 1-minute authentic conversation, then decide if you'd like to continue chatting and meet up.
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Ready to Find Your Match?
            </h2>
            <p className="text-xl text-white/80 mb-8">
              Join thousands of people who have found meaningful connections through authentic video dating.
            </p>
            <Link to="/register" className="btn-primary text-xl px-10 py-5 inline-block">
              Get Started Free
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
