#!/bin/bash

#========================================
# node install dependences
#========================================

cd ../src

echo "install modules"
npm install

wait

echo ""

c_dir=$(pwd)

echo "Creating auto start file"

#========================================
# Create script file
#========================================

cat<<EOF > "$c_dir/run.sh"
#!/bin/bash
clear
cd $c_dir
sleep 120
npm start
EOF

chmod +x $c_dir/run.sh

#========================================
# Create Auto-run script after boot up
#========================================

if [ ! -d ~/.config/autostart ]; then 
	sudo mkdir -p ~/.config/autostart
fi

sudo touch ~/.config/autostart/lauch_housekeeper_bee_ai_tools.desktop

echo "[Desktop Entry]
Type=Application
Exec=gnome-terminal -- bash -c \"$c_dir/run.sh; exec bash\"
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Name[C]=housekeeper bee AI tools
Name=housekeeper bee AI tools
Comment[C]=
Comment=
" | sudo tee -a  ~/.config/autostart/lauch_housekeeper_bee_ai_tools.desktop >> /dev/null


echo "Done"




